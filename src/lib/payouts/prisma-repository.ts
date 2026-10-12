import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MAX_UNITS } from "@/lib/rewards/money";
import { deriveBatchStatus } from "@/lib/payouts/batch-status";
import { LEDGER_PROVIDER, OPEN_WITHDRAWAL_STATUSES, isWithdrawalStatus, type WithdrawalStatus } from "@/lib/payouts/constants";
import { canApprove, canReject, decideSettlement, planRequest, settlementFacts } from "@/lib/payouts/decisions";
import type {
  PayoutAccountSnapshot,
  PayoutRepository,
  RequestWithdrawalResult,
  RetryResult,
  ReviewResult,
  SettleResult,
  WithdrawalSnapshot,
} from "@/lib/payouts/repository";

const withdrawalInclude = {
  user: { select: { email: true } },
  attempts: true,
  batch: true,
} satisfies Prisma.WithdrawalInclude;

type WithdrawalRow = Prisma.WithdrawalGetPayload<{ include: typeof withdrawalInclude }>;

class PayoutWriteConflict extends Error {
  constructor() {
    super("payout write conflict");
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof PayoutWriteConflict) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  return error instanceof Error && /write conflict/i.test(error.message);
}

function isDuplicate(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function runMoneyTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(work, { maxWait: 10_000, timeout: 20_000 });
}

async function withRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt < 3 && isRetryable(error)) continue;
      throw error;
    }
  }
  throw new Error("payout transaction failed");
}

function clip(value: string, max = 300): string {
  return value.slice(0, max);
}

export class PrismaPayoutRepository implements PayoutRepository {
  async getBalance(userId: string) {
    const account = await prisma.rewardAccount.findUnique({ where: { userId } });
    if (!account) return null;
    return {
      availableUnits: account.availableUnits,
      reservedUnits: account.reservedUnits,
      lifetimeCreditedUnits: account.lifetimeCreditedUnits,
    };
  }

  async getPayoutAccount(userId: string) {
    const account = await prisma.payoutAccount.findUnique({ where: { userId } });
    return account ? toAccount(account) : null;
  }

  async savePayoutAccount(input: PayoutAccountSnapshot) {
    try {
      const owner = await prisma.payoutAccount.findUnique({ where: { recipientCode: input.recipientCode } });
      if (owner && owner.userId !== input.userId) return { ok: false as const, code: "recipient_taken" as const };
      await prisma.payoutAccount.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          bankCode: input.bankCode,
          bankName: input.bankName,
          accountLast4: input.accountLast4,
          accountName: input.accountName,
          recipientCode: input.recipientCode,
        },
        update: {
          bankCode: input.bankCode,
          bankName: input.bankName,
          accountLast4: input.accountLast4,
          accountName: input.accountName,
          recipientCode: input.recipientCode,
        },
      });
      return { ok: true as const };
    } catch (error) {
      if (isDuplicate(error)) return { ok: false as const, code: "recipient_taken" as const };
      throw error;
    }
  }

  async requestWithdrawal(input: {
    userId: string;
    points: number;
    amountKobo: number;
    minimumKobo: number;
    reference: string;
    status: "PENDING" | "UNDER_REVIEW" | "APPROVED";
    currencyCode: string;
    at: Date;
    nairaPerUsd?: number | null;
    rateAt?: Date | null;
    usdCents?: number | null;
  }): Promise<RequestWithdrawalResult> {
    try {
      return await withRetry(() => this.requestOnce(input));
    } catch (error) {
      if (isRetryable(error)) return { ok: false, code: "conflict" };
      if (isDuplicate(error)) return { ok: false, code: "duplicate_reference" };
      throw error;
    }
  }

  async listForUser(userId: string) {
    const rows = await prisma.withdrawal.findMany({
      where: { userId },
      include: withdrawalInclude,
      orderBy: { requestedAt: "desc" },
      take: 50,
    });
    return hydrate(rows);
  }

  async listRecent(limit: number) {
    const rows = await prisma.withdrawal.findMany({
      include: withdrawalInclude,
      orderBy: { requestedAt: "desc" },
      take: limit,
    });
    return hydrate(rows);
  }

  async getById(id: string) {
    const row = await prisma.withdrawal.findUnique({ where: { id }, include: withdrawalInclude });
    if (!row) return null;
    const [snapshot] = await hydrate([row]);
    return snapshot ?? null;
  }

  async getByReference(reference: string) {
    const attempt = await prisma.transferAttempt.findUnique({ where: { reference }, select: { withdrawalId: true } });
    if (!attempt) return null;
    return this.getById(attempt.withdrawalId);
  }

  async countPaid(userId: string) {
    return prisma.withdrawal.count({ where: { userId, status: { in: ["PAID", "REVERSED"] } } });
  }

  async review(input: { id: string; actorId: string; decision: "approve" | "reject"; reason: string | null; at: Date }): Promise<ReviewResult> {
    try {
      return await withRetry(() => this.reviewOnce(input));
    } catch (error) {
      if (isRetryable(error)) return { ok: false, code: "conflict" };
      throw error;
    }
  }

  async listApproved(limit: number) {
    const rows = await prisma.withdrawal.findMany({
      where: { status: "APPROVED", batchId: null },
      include: withdrawalInclude,
      orderBy: { requestedAt: "asc" },
      take: limit,
    });
    return hydrate(rows);
  }

  async tryAdvanceGate(now: Date, gapMs: number) {
    await prisma.payoutGate.upsert({
      where: { key: "bulk" },
      create: { key: "bulk", nextAllowedAt: new Date(0) },
      update: {},
    });
    const updated = await prisma.payoutGate.updateMany({
      where: { key: "bulk", nextAllowedAt: { lte: now } },
      data: { nextAllowedAt: new Date(now.getTime() + gapMs) },
    });
    return updated.count === 1;
  }

  async claimApproved(ids: string[], at: Date) {
    const claimed: WithdrawalSnapshot[] = [];
    for (const id of ids) {
      const updated = await prisma.withdrawal.updateMany({
        where: { id, status: "APPROVED" },
        data: { status: "PROCESSING", processingAt: at },
      });
      if (updated.count !== 1) continue;
      const current = await prisma.withdrawal.findUnique({ where: { id }, select: { reference: true } });
      if (current) {
        await prisma.transferAttempt.updateMany({ where: { reference: current.reference }, data: { status: "PROCESSING" } });
      }
      const snapshot = await this.getById(id);
      if (snapshot) claimed.push(snapshot);
    }
    return claimed;
  }

  async createBatch(input: { actorId: string; transferCount: number; message: string | null; submittedAt: Date; withdrawalIds: string[] }) {
    const batch = await prisma.payoutBatch.create({
      data: {
        status: "PREPARING",
        transferCount: input.transferCount,
        message: input.message,
        actorId: input.actorId,
        submittedAt: input.submittedAt,
        currency: "NGN",
      },
    });
    if (input.withdrawalIds.length > 0) {
      await prisma.withdrawal.updateMany({
        where: { id: { in: input.withdrawalIds }, status: "PROCESSING" },
        data: { batchId: batch.id },
      });
    }
    await prisma.payoutAudit.create({
      data: { actorId: input.actorId, action: "batch.submitted", batchId: batch.id, detail: `${input.transferCount} transfers` },
    });
    return { id: batch.id };
  }

  async createPendingBatch(input: {
    transferCount: number;
    totalPoints: number;
    totalKobo: number;
    nairaPerUsd: number | null;
    rateAt: Date | null;
    withdrawalIds: string[];
  }) {
    try {
      return await runMoneyTransaction(async (tx) => {
        const batch = await tx.payoutBatch.create({
          data: {
            status: "PENDING",
            transferCount: input.transferCount,
            totalPoints: input.totalPoints,
            totalKobo: input.totalKobo,
            nairaPerUsd: input.nairaPerUsd,
            rateAt: input.rateAt,
            currency: "NGN",
            message: null,
          },
        });
        const linked = await tx.withdrawal.updateMany({
          where: { id: { in: input.withdrawalIds }, status: "APPROVED", batchId: null },
          data: { batchId: batch.id },
        });
        if (linked.count !== input.withdrawalIds.length) throw new PayoutWriteConflict();
        await tx.payoutAudit.create({
          data: { actorId: null, action: "batch.enrolled", batchId: batch.id, detail: `${input.transferCount} payouts` },
        });
        return { ok: true as const, id: batch.id };
      });
    } catch (error) {
      if (error instanceof PayoutWriteConflict || isRetryable(error)) return { ok: false as const, code: "conflict" as const };
      throw error;
    }
  }

  async oldestPendingBatch() {
    const batch = await prisma.payoutBatch.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { withdrawals: { where: { status: "APPROVED" }, select: { id: true } } },
    });
    if (!batch) return null;
    return { id: batch.id, withdrawalIds: batch.withdrawals.map((row) => row.id) };
  }

  async detachUnclaimed(batchId: string, claimedIds: string[]) {
    await prisma.withdrawal.updateMany({
      where: { batchId, status: "APPROVED", id: { notIn: claimedIds } },
      data: { batchId: null },
    });
  }

  async updateBatch(id: string, input: { status: string; message: string | null; submittedAt?: Date }) {
    await prisma.payoutBatch.update({
      where: { id },
      data: { status: input.status, message: input.message, ...(input.submittedAt ? { submittedAt: input.submittedAt } : {}) },
    });
  }

  async setTransferCode(reference: string, transferCode: string) {
    await prisma.transferAttempt.updateMany({ where: { reference }, data: { transferCode } });
    await prisma.withdrawal.updateMany({ where: { reference }, data: { transferCode } });
  }

  async settle(input: {
    reference: string;
    verified: "success" | "failed" | "reversed";
    amountKobo: number | null;
    currency: string | null;
    transferCode: string | null;
    at: Date;
  }): Promise<SettleResult> {
    return withRetry(() => this.settleOnce(input));
  }

  async releaseUnsent(input: { reference: string; at: Date; reason: string }): Promise<SettleResult> {
    return withRetry(() =>
      runMoneyTransaction(async (tx) => {
        const row = await tx.withdrawal.findUnique({ where: { reference: input.reference } });
        if (!row || row.status !== "PROCESSING") return "ignored" as const;
        const released = await releaseReservation(tx, row, input.at, input.reason, "FAILED");
        if (!released) throw new PayoutWriteConflict();
        await tx.transferAttempt.updateMany({
          where: { reference: input.reference },
          data: { status: "FAILED", failureReason: clip(input.reason) },
        });
        await syncBatchStatus(tx, row.batchId);
        return "failed" as const;
      }),
    );
  }

  async beginRetry(input: {
    withdrawalId: string;
    actorId: string;
    reference: string;
    minimumKobo: number;
    currencyCode: string;
    at: Date;
  }): Promise<RetryResult> {
    try {
      return await withRetry(() => this.retryOnce(input));
    } catch (error) {
      if (isRetryable(error)) return { ok: false, code: "conflict" };
      if (isDuplicate(error)) return { ok: false, code: "duplicate_reference" };
      throw error;
    }
  }

  async setAnomaly(withdrawalId: string, anomaly: string) {
    await prisma.withdrawal.updateMany({ where: { id: withdrawalId }, data: { anomaly: clip(anomaly) } });
  }

  async findEvent(eventKey: string) {
    const event = await prisma.paystackEvent.findUnique({ where: { eventKey }, select: { processedAt: true } });
    return event ? { processedAt: event.processedAt } : null;
  }

  async createEvent(input: { eventKey: string; event: string; reference: string | null }) {
    try {
      await prisma.paystackEvent.create({
        data: { eventKey: input.eventKey, event: input.event, reference: input.reference },
      });
      return "created" as const;
    } catch (error) {
      if (isDuplicate(error)) return "exists" as const;
      throw error;
    }
  }

  async markEventProcessed(eventKey: string, note: string | null) {
    await prisma.paystackEvent.updateMany({
      where: { eventKey },
      data: { processedAt: new Date(), note: note ? clip(note) : null },
    });
  }

  async recordAudit(input: { actorId: string | null; action: string; withdrawalId?: string; batchId?: string; detail?: string }) {
    await prisma.payoutAudit.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        withdrawalId: input.withdrawalId,
        batchId: input.batchId,
        detail: input.detail ? clip(input.detail) : null,
      },
    });
  }

  private async requestOnce(input: {
    userId: string;
    points: number;
    amountKobo: number;
    minimumKobo: number;
    reference: string;
    status: "PENDING" | "UNDER_REVIEW" | "APPROVED";
    currencyCode: string;
    at: Date;
    nairaPerUsd?: number | null;
    rateAt?: Date | null;
    usdCents?: number | null;
  }): Promise<RequestWithdrawalResult> {
    return runMoneyTransaction(async (tx) => {
      const account = await tx.rewardAccount.findUnique({ where: { userId: input.userId } });
      const payout = await tx.payoutAccount.findUnique({ where: { userId: input.userId } });
      const open = await tx.withdrawal.findFirst({
        where: { userId: input.userId, status: { in: [...OPEN_WITHDRAWAL_STATUSES] } },
        select: { id: true },
      });
      const plan = planRequest({
        hasAccount: Boolean(payout),
        availableUnits: account?.availableUnits ?? 0,
        reservedUnits: account?.reservedUnits ?? 0,
        openWithdrawal: Boolean(open),
        points: input.points,
        amountKobo: input.amountKobo,
        minimumKobo: input.minimumKobo,
      });
      if (!plan.ok || !payout || !account) return plan.ok ? { ok: false, code: "no_account" } : plan;
      const reserved = await tx.rewardAccount.updateMany({
        where: {
          userId: input.userId,
          reservedUnits: account.reservedUnits,
          availableUnits: account.availableUnits,
        },
        data: { reservedUnits: { increment: input.points } },
      });
      if (reserved.count !== 1) throw new PayoutWriteConflict();
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: input.userId,
          points: input.points,
          amountKobo: input.amountKobo,
          currency: "NGN",
          recipientCode: payout.recipientCode,
          reference: input.reference,
          status: input.status,
          nairaPerUsd: input.nairaPerUsd ?? null,
          rateAt: input.rateAt ?? null,
          usdCents: input.usdCents ?? null,
          attempt: 1,
          requestedAt: input.at,
          reviewedAt: input.status === "APPROVED" ? input.at : null,
        },
      });
      await tx.transferAttempt.create({
        data: { withdrawalId: withdrawal.id, reference: input.reference, status: "RESERVED" },
      });
      await tx.rewardTransaction.create({
        data: {
          userId: input.userId,
          provider: LEDGER_PROVIDER,
          providerTxId: input.reference,
          type: "WITHDRAWAL",
          amountUnits: -input.points,
          appliedUnits: 0,
          currencyCode: input.currencyCode,
          status: "RESERVED",
          reason: "Withdrawal reserved",
        },
      });
      await tx.payoutAudit.create({
        data: {
          actorId: input.userId,
          action: input.status === "APPROVED" ? "withdrawal.scheduled" : "withdrawal.requested",
          withdrawalId: withdrawal.id,
          detail: input.reference,
        },
      });
      const stored = await tx.withdrawal.findUnique({ where: { id: withdrawal.id }, include: withdrawalInclude });
      if (!stored) throw new PayoutWriteConflict();
      const [snapshot] = await hydrate([stored], tx);
      if (!snapshot) throw new PayoutWriteConflict();
      return { ok: true, withdrawal: snapshot };
    });
  }

  private async reviewOnce(input: { id: string; actorId: string; decision: "approve" | "reject"; reason: string | null; at: Date }): Promise<ReviewResult> {
    return runMoneyTransaction(async (tx) => {
      const row = await tx.withdrawal.findUnique({ where: { id: input.id } });
      if (!row || !isWithdrawalStatus(row.status)) return { ok: false, code: "missing" };
      if (input.decision === "approve") {
        if (!canApprove(row.status)) return { ok: false, code: "not_allowed" };
        const updated = await tx.withdrawal.updateMany({
          where: { id: row.id, status: row.status },
          data: { status: "APPROVED", reviewedAt: input.at, reviewedBy: input.actorId },
        });
        if (updated.count !== 1) throw new PayoutWriteConflict();
        await tx.payoutAudit.create({
          data: { actorId: input.actorId, action: "withdrawal.approved", withdrawalId: row.id },
        });
        return { ok: true, status: "APPROVED" as const };
      }
      if (!canReject(row.status)) return { ok: false, code: "not_allowed" };
      const released = await releaseReservation(tx, row, input.at, input.reason ?? "Rejected before the transfer was sent.", "REJECTED");
      if (!released) throw new PayoutWriteConflict();
      await tx.withdrawal.update({ where: { id: row.id }, data: { reviewedAt: input.at, reviewedBy: input.actorId } });
      await tx.payoutAudit.create({
        data: { actorId: input.actorId, action: "withdrawal.rejected", withdrawalId: row.id, detail: input.reason },
      });
      await syncBatchStatus(tx, row.batchId);
      return { ok: true, status: "REJECTED" as const };
    });
  }

  private async settleOnce(input: {
    reference: string;
    verified: "success" | "failed" | "reversed";
    amountKobo: number | null;
    currency: string | null;
    transferCode: string | null;
    at: Date;
  }): Promise<SettleResult> {
    return runMoneyTransaction(async (tx) => {
      const attempt = await tx.transferAttempt.findUnique({
        where: { reference: input.reference },
        include: { withdrawal: true },
      });
      if (!attempt) return "ignored";
      const row = attempt.withdrawal;
      if (!isWithdrawalStatus(row.status)) return "ignored";
      const facts = settlementFacts({
        verified: input.verified,
        amountKobo: input.amountKobo,
        currency: input.currency,
        expectedKobo: row.amountKobo,
      });
      const decision = decideSettlement({
        status: row.status,
        currentReference: row.reference,
        eventReference: input.reference,
        verified: input.verified,
        amountMatches: facts.amountMatches,
        currencyMatches: facts.currencyMatches,
      });
      if (decision.type === "ignore") return "ignored";
      if (decision.type === "anomaly") {
        await tx.withdrawal.update({ where: { id: row.id }, data: { anomaly: clip(decision.anomaly) } });
        return "anomaly";
      }
      if (decision.type === "pay") {
        const moved = await tx.withdrawal.updateMany({
          where: { id: row.id, status: "PROCESSING", reference: input.reference },
          data: { status: "PAID", completedAt: input.at, transferCode: input.transferCode, anomaly: null },
        });
        if (moved.count !== 1) return "ignored";
        const balance = await tx.rewardAccount.updateMany({
          where: { userId: row.userId, reservedUnits: { gte: row.points }, availableUnits: { gte: row.points } },
          data: { reservedUnits: { decrement: row.points }, availableUnits: { decrement: row.points } },
        });
        if (balance.count !== 1) throw new PayoutWriteConflict();
        const ledger = await tx.rewardTransaction.updateMany({
          where: { provider: LEDGER_PROVIDER, providerTxId: row.reference, status: "RESERVED" },
          data: { status: "PAID", appliedUnits: -row.points },
        });
        if (ledger.count !== 1) throw new PayoutWriteConflict();
        await tx.transferAttempt.update({
          where: { reference: input.reference },
          data: { status: "PAID", transferCode: input.transferCode },
        });
        await syncBatchStatus(tx, row.batchId);
        return "paid";
      }
      if (decision.type === "fail") {
        const released = await releaseReservation(tx, row, input.at, decision.reason, "FAILED");
        if (!released) throw new PayoutWriteConflict();
        await tx.transferAttempt.updateMany({
          where: { reference: input.reference },
          data: { status: "FAILED", failureReason: clip(decision.reason) },
        });
        await syncBatchStatus(tx, row.batchId);
        return "failed";
      }
      if (decision.type === "reverse-paid") {
        const account = await tx.rewardAccount.findUnique({ where: { userId: row.userId } });
        if (!account || account.availableUnits > MAX_UNITS - row.points) throw new PayoutWriteConflict();
        const moved = await tx.withdrawal.updateMany({
          where: { id: row.id, status: "PAID", reference: input.reference },
          data: { status: "REVERSED", completedAt: input.at },
        });
        if (moved.count !== 1) return "ignored";
        const original = await tx.rewardTransaction.findUnique({
          where: { provider_providerTxId: { provider: LEDGER_PROVIDER, providerTxId: row.reference } },
        });
        await tx.rewardTransaction.create({
          data: {
            userId: row.userId,
            provider: LEDGER_PROVIDER,
            providerTxId: `${row.reference}:reversal`,
            type: "WITHDRAWAL_REVERSAL",
            amountUnits: row.points,
            appliedUnits: row.points,
            currencyCode: original?.currencyCode ?? "PTS",
            status: "REVERSED",
            reason: "Paystack reversed the transfer.",
          },
        });
        const balance = await tx.rewardAccount.updateMany({
          where: { userId: row.userId, availableUnits: account.availableUnits },
          data: { availableUnits: { increment: row.points } },
        });
        if (balance.count !== 1) throw new PayoutWriteConflict();
        await tx.transferAttempt.updateMany({ where: { reference: input.reference }, data: { status: "REVERSED" } });
        await syncBatchStatus(tx, row.batchId);
        return "reversed";
      }
      const moved = await tx.withdrawal.updateMany({
        where: { id: row.id, status: "PROCESSING", reference: input.reference },
        data: { status: "REVERSED", completedAt: input.at },
      });
      if (moved.count !== 1) return "ignored";
      const balance = await tx.rewardAccount.updateMany({
        where: { userId: row.userId, reservedUnits: { gte: row.points } },
        data: { reservedUnits: { decrement: row.points } },
      });
      if (balance.count !== 1) throw new PayoutWriteConflict();
      await tx.rewardTransaction.updateMany({
        where: { provider: LEDGER_PROVIDER, providerTxId: row.reference, status: "RESERVED" },
        data: { status: "REVERSED", appliedUnits: 0, reason: "Transfer reversed before the debit was finalized." },
      });
      await tx.transferAttempt.updateMany({ where: { reference: input.reference }, data: { status: "REVERSED" } });
      await syncBatchStatus(tx, row.batchId);
      return "reversed";
    });
  }

  private async retryOnce(input: {
    withdrawalId: string;
    actorId: string;
    reference: string;
    minimumKobo: number;
    currencyCode: string;
    at: Date;
  }): Promise<RetryResult> {
    return runMoneyTransaction(async (tx) => {
      const row = await tx.withdrawal.findUnique({ where: { id: input.withdrawalId } });
      if (!row) return { ok: false, code: "missing" };
      if (row.status !== "FAILED") return { ok: false, code: "not_failed" };
      const account = await tx.rewardAccount.findUnique({ where: { userId: row.userId } });
      const payout = await tx.payoutAccount.findUnique({ where: { userId: row.userId } });
      const open = await tx.withdrawal.findFirst({
        where: { userId: row.userId, id: { not: row.id }, status: { in: [...OPEN_WITHDRAWAL_STATUSES] } },
        select: { id: true },
      });
      const plan = planRequest({
        hasAccount: Boolean(payout),
        availableUnits: account?.availableUnits ?? 0,
        reservedUnits: account?.reservedUnits ?? 0,
        openWithdrawal: Boolean(open),
        points: row.points,
        amountKobo: row.amountKobo,
        minimumKobo: input.minimumKobo,
      });
      if (!plan.ok || !payout || !account) {
        return { ok: false, code: plan.ok ? "no_account" : plan.code === "invalid_amount" || plan.code === "below_minimum" ? "conflict" : plan.code };
      }
      const reserved = await tx.rewardAccount.updateMany({
        where: { userId: row.userId, reservedUnits: account.reservedUnits, availableUnits: account.availableUnits },
        data: { reservedUnits: { increment: row.points } },
      });
      if (reserved.count !== 1) throw new PayoutWriteConflict();
      const updated = await tx.withdrawal.updateMany({
        where: { id: row.id, status: "FAILED" },
        data: {
          reference: input.reference,
          recipientCode: payout.recipientCode,
          status: "APPROVED",
          attempt: { increment: 1 },
          failureReason: null,
          transferCode: null,
          batchId: null,
          processingAt: null,
          completedAt: null,
          anomaly: null,
          reviewedAt: input.at,
          reviewedBy: input.actorId,
        },
      });
      if (updated.count !== 1) throw new PayoutWriteConflict();
      await tx.transferAttempt.create({
        data: { withdrawalId: row.id, reference: input.reference, status: "RESERVED" },
      });
      await tx.rewardTransaction.create({
        data: {
          userId: row.userId,
          provider: LEDGER_PROVIDER,
          providerTxId: input.reference,
          type: "WITHDRAWAL",
          amountUnits: -row.points,
          appliedUnits: 0,
          currencyCode: input.currencyCode,
          status: "RESERVED",
          reason: "Withdrawal reserved for a new attempt",
        },
      });
      await tx.payoutAudit.create({
        data: { actorId: input.actorId, action: "withdrawal.retry", withdrawalId: row.id, detail: input.reference },
      });
      return { ok: true, reference: input.reference };
    });
  }
}

export const prismaPayouts = new PrismaPayoutRepository();

async function syncBatchStatus(tx: Prisma.TransactionClient, batchId: string | null): Promise<void> {
  if (!batchId) return;
  const batch = await tx.payoutBatch.findUnique({ where: { id: batchId }, select: { status: true } });
  if (!batch) return;
  const members = await tx.withdrawal.findMany({ where: { batchId }, select: { status: true } });
  const next = deriveBatchStatus(members.map((member) => member.status), batch.status);
  if (!next) return;
  await tx.payoutBatch.update({ where: { id: batchId }, data: { status: next } });
}

async function hydrate(rows: WithdrawalRow[], source: Prisma.TransactionClient | typeof prisma = prisma): Promise<WithdrawalSnapshot[]> {
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const [accounts, balances] = await Promise.all([
    source.payoutAccount.findMany({ where: { userId: { in: userIds } } }),
    source.rewardAccount.findMany({ where: { userId: { in: userIds } } }),
  ]);
  const accountByUser = new Map(accounts.map((account) => [account.userId, account]));
  const balanceByUser = new Map(balances.map((account) => [account.userId, account]));
  return rows.flatMap((row) => {
    if (!isWithdrawalStatus(row.status)) return [];
    const payout = accountByUser.get(row.userId);
    const balance = balanceByUser.get(row.userId);
    return [
      {
        id: row.id,
        userId: row.userId,
        userEmail: row.user.email,
        points: row.points,
        amountKobo: row.amountKobo,
        currency: row.currency,
        recipientCode: row.recipientCode,
        reference: row.reference,
        status: row.status,
        failureReason: row.failureReason,
        transferCode: row.transferCode,
        batchId: row.batchId,
        batchStatus: row.batch?.status ?? null,
        attempt: row.attempt,
        anomaly: row.anomaly,
        nairaPerUsd: row.nairaPerUsd,
        rateAt: row.rateAt,
        usdCents: row.usdCents,
        requestedAt: row.requestedAt,
        reviewedAt: row.reviewedAt,
        reviewedBy: row.reviewedBy,
        processingAt: row.processingAt,
        completedAt: row.completedAt,
        bankName: payout?.bankName ?? null,
        accountLast4: payout?.accountLast4 ?? null,
        accountName: payout?.accountName ?? null,
        accountUpdatedAt: payout?.updatedAt ?? null,
        availableUnits: balance?.availableUnits ?? 0,
        reservedUnits: balance?.reservedUnits ?? 0,
        attempts: row.attempts.map((attempt) => ({
          reference: attempt.reference,
          status: attempt.status,
          transferCode: attempt.transferCode,
          createdAt: attempt.createdAt,
        })),
      },
    ];
  });
}

function toAccount(account: {
  userId: string;
  bankCode: string;
  bankName: string;
  accountLast4: string;
  accountName: string;
  recipientCode: string;
  updatedAt: Date;
}): PayoutAccountSnapshot {
  return {
    userId: account.userId,
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountLast4: account.accountLast4,
    accountName: account.accountName,
    recipientCode: account.recipientCode,
    updatedAt: account.updatedAt,
  };
}

async function releaseReservation(
  tx: Prisma.TransactionClient,
  row: { id: string; userId: string; points: number; reference: string; status: string },
  at: Date,
  reason: string,
  status: "FAILED" | "REJECTED",
): Promise<boolean> {
  if (!isWithdrawalStatus(row.status) || !(OPEN_WITHDRAWAL_STATUSES as readonly WithdrawalStatus[]).includes(row.status)) return false;
  const moved = await tx.withdrawal.updateMany({
    where: { id: row.id, status: row.status, reference: row.reference },
    data: { status, failureReason: clip(reason), completedAt: at },
  });
  if (moved.count !== 1) return false;
  const balance = await tx.rewardAccount.updateMany({
    where: { userId: row.userId, reservedUnits: { gte: row.points } },
    data: { reservedUnits: { decrement: row.points } },
  });
  if (balance.count !== 1) return false;
  const ledger = await tx.rewardTransaction.updateMany({
    where: { provider: LEDGER_PROVIDER, providerTxId: row.reference, status: "RESERVED" },
    data: { status: "RELEASED", appliedUnits: 0, reason: clip(reason) },
  });
  return ledger.count === 1;
}
