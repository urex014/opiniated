import { deriveBatchStatus } from "@/lib/payouts/batch-status";
import { OPEN_WITHDRAWAL_STATUSES, type WithdrawalStatus } from "@/lib/payouts/constants";
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

type UserRow = {
  email: string;
  availableUnits: number;
  reservedUnits: number;
  lifetimeCreditedUnits: number;
  payout: PayoutAccountSnapshot | null;
};

type AttemptRow = {
  withdrawalId: string;
  reference: string;
  status: string;
  transferCode: string | null;
  createdAt: Date;
};

type WithdrawalRow = {
  id: string;
  userId: string;
  points: number;
  amountKobo: number;
  currency: string;
  recipientCode: string;
  reference: string;
  status: WithdrawalStatus;
  failureReason: string | null;
  transferCode: string | null;
  batchId: string | null;
  attempt: number;
  anomaly: string | null;
  nairaPerUsd: number | null;
  rateAt: Date | null;
  usdCents: number | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  processingAt: Date | null;
  completedAt: Date | null;
};

type LedgerRow = {
  userId: string;
  providerTxId: string;
  status: string;
  appliedUnits: number;
  type: string;
  currencyCode: string;
};

type BatchRow = {
  id: string;
  status: string;
  message: string | null;
  withdrawalIds: string[];
  transferCount: number;
  totalKobo: number;
  totalPoints: number;
  nairaPerUsd: number | null;
  rateAt: Date | null;
  createdAt: Date;
};

export class MemoryPayoutRepository implements PayoutRepository {
  private users = new Map<string, UserRow>();
  private withdrawals: WithdrawalRow[] = [];
  private attempts: AttemptRow[] = [];
  private ledger: LedgerRow[] = [];
  private batches: BatchRow[] = [];
  private events = new Map<string, { event: string; reference: string | null; processedAt: Date | null; note: string | null }>();
  private audits: { action: string; actorId?: string | null; withdrawalId?: string; batchId?: string; detail?: string }[] = [];
  private references = new Set<string>();
  private gate = new Date(0);
  private sequence = 0;
  private queue: Promise<void> = Promise.resolve();

  seedUser(input: {
    id: string;
    email: string;
    availableUnits: number;
    reservedUnits?: number;
    lifetimeCreditedUnits?: number;
    payout?: Omit<PayoutAccountSnapshot, "userId">;
  }): void {
    this.users.set(input.id, {
      email: input.email,
      availableUnits: input.availableUnits,
      reservedUnits: input.reservedUnits ?? 0,
      lifetimeCreditedUnits: input.lifetimeCreditedUnits ?? input.availableUnits,
      payout: input.payout ? { ...input.payout, userId: input.id } : null,
    });
  }

  balanceOf(userId: string): { availableUnits: number; reservedUnits: number } {
    const user = this.users.get(userId);
    return { availableUnits: user?.availableUnits ?? 0, reservedUnits: user?.reservedUnits ?? 0 };
  }

  ledgerRows(userId: string): LedgerRow[] {
    return this.ledger.filter((row) => row.userId === userId);
  }

  auditCount(action: string): number {
    return this.audits.filter((row) => row.action === action).length;
  }

  auditsFor(action: string): { action: string; actorId?: string | null; withdrawalId?: string; batchId?: string; detail?: string }[] {
    return this.audits.filter((row) => row.action === action);
  }

  batchRows(): { id: string; status: string; transferCount: number; withdrawalIds: string[] }[] {
    return this.batches.map((batch) => ({
      id: batch.id,
      status: batch.status,
      transferCount: batch.transferCount,
      withdrawalIds: [...batch.withdrawalIds],
    }));
  }

  private exclusive<T>(work: () => T): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private id(): string {
    this.sequence += 1;
    return `mem_${this.sequence.toString(16).padStart(8, "0")}`;
  }

  private snapshot(row: WithdrawalRow): WithdrawalSnapshot {
    const user = this.users.get(row.userId);
    const batch = this.batches.find((item) => item.id === row.batchId);
    return {
      ...row,
      userEmail: user?.email ?? "",
      batchStatus: batch?.status ?? null,
      bankName: user?.payout?.bankName ?? null,
      accountLast4: user?.payout?.accountLast4 ?? null,
      accountName: user?.payout?.accountName ?? null,
      accountUpdatedAt: user?.payout?.updatedAt ?? null,
      availableUnits: user?.availableUnits ?? 0,
      reservedUnits: user?.reservedUnits ?? 0,
      attempts: this.attempts
        .filter((attempt) => attempt.withdrawalId === row.id)
        .map((attempt) => ({
          reference: attempt.reference,
          status: attempt.status,
          transferCode: attempt.transferCode,
          createdAt: attempt.createdAt,
        })),
    };
  }

  async getBalance(userId: string) {
    return this.exclusive(() => {
      const user = this.users.get(userId);
      if (!user) return null;
      return {
        availableUnits: user.availableUnits,
        reservedUnits: user.reservedUnits,
        lifetimeCreditedUnits: user.lifetimeCreditedUnits,
      };
    });
  }

  async getPayoutAccount(userId: string) {
    return this.exclusive(() => this.users.get(userId)?.payout ?? null);
  }

  async savePayoutAccount(input: PayoutAccountSnapshot) {
    return this.exclusive(() => {
      for (const user of this.users.values()) {
        if (user.payout?.recipientCode === input.recipientCode && user.payout.userId !== input.userId) {
          return { ok: false as const, code: "recipient_taken" as const };
        }
      }
      const user = this.users.get(input.userId);
      if (!user) return { ok: false as const, code: "recipient_taken" as const };
      user.payout = { ...input };
      return { ok: true as const };
    });
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
    return this.exclusive(() => {
      if (this.references.has(input.reference)) return { ok: false, code: "duplicate_reference" };
      const user = this.users.get(input.userId);
      const open = this.withdrawals.some(
        (row) => row.userId === input.userId && (OPEN_WITHDRAWAL_STATUSES as readonly string[]).includes(row.status),
      );
      const plan = planRequest({
        hasAccount: Boolean(user?.payout),
        availableUnits: user?.availableUnits ?? 0,
        reservedUnits: user?.reservedUnits ?? 0,
        openWithdrawal: open,
        points: input.points,
        amountKobo: input.amountKobo,
        minimumKobo: input.minimumKobo,
      });
      if (!plan.ok || !user?.payout) return plan.ok ? { ok: false, code: "no_account" } : plan;
      user.reservedUnits += input.points;
      const row: WithdrawalRow = {
        id: this.id(),
        userId: input.userId,
        points: input.points,
        amountKobo: input.amountKobo,
        currency: "NGN",
        recipientCode: user.payout.recipientCode,
        reference: input.reference,
        status: input.status,
        failureReason: null,
        transferCode: null,
        batchId: null,
        attempt: 1,
        anomaly: null,
        nairaPerUsd: input.nairaPerUsd ?? null,
        rateAt: input.rateAt ?? null,
        usdCents: input.usdCents ?? null,
        requestedAt: input.at,
        reviewedAt: input.status === "APPROVED" ? input.at : null,
        reviewedBy: null,
        processingAt: null,
        completedAt: null,
      };
      this.withdrawals.push(row);
      this.references.add(input.reference);
      this.attempts.push({ withdrawalId: row.id, reference: input.reference, status: "RESERVED", transferCode: null, createdAt: input.at });
      this.ledger.push({
        userId: input.userId,
        providerTxId: input.reference,
        status: "RESERVED",
        appliedUnits: 0,
        type: "WITHDRAWAL",
        currencyCode: input.currencyCode,
      });
      return { ok: true, withdrawal: this.snapshot(row) };
    });
  }

  async listForUser(userId: string) {
    return this.exclusive(() =>
      this.withdrawals
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
        .map((row) => this.snapshot(row)),
    );
  }

  async listRecent(limit: number) {
    return this.exclusive(() =>
      [...this.withdrawals]
        .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
        .slice(0, limit)
        .map((row) => this.snapshot(row)),
    );
  }

  async getById(id: string) {
    return this.exclusive(() => {
      const row = this.withdrawals.find((item) => item.id === id);
      return row ? this.snapshot(row) : null;
    });
  }

  async getByReference(reference: string) {
    return this.exclusive(() => {
      const attempt = this.attempts.find((item) => item.reference === reference);
      const row = attempt
        ? this.withdrawals.find((item) => item.id === attempt.withdrawalId)
        : this.withdrawals.find((item) => item.reference === reference);
      return row ? this.snapshot(row) : null;
    });
  }

  async countPaid(userId: string) {
    return this.exclusive(
      () => this.withdrawals.filter((row) => row.userId === userId && (row.status === "PAID" || row.status === "REVERSED")).length,
    );
  }

  async review(input: { id: string; actorId: string; decision: "approve" | "reject"; reason: string | null; at: Date }): Promise<ReviewResult> {
    return this.exclusive(() => {
      const row = this.withdrawals.find((item) => item.id === input.id);
      if (!row) return { ok: false, code: "missing" };
      if (input.decision === "approve") {
        if (!canApprove(row.status)) return { ok: false, code: "not_allowed" };
        row.status = "APPROVED";
        row.reviewedAt = input.at;
        row.reviewedBy = input.actorId;
        this.audits.push({ action: "withdrawal.approved", withdrawalId: row.id });
        return { ok: true, status: row.status };
      }
      if (!canReject(row.status)) return { ok: false, code: "not_allowed" };
      const released = this.release(row, input.at, input.reason ?? "Rejected before the transfer was sent.", "REJECTED");
      if (!released) return { ok: false, code: "conflict" };
      row.reviewedAt = input.at;
      row.reviewedBy = input.actorId;
      this.audits.push({ action: "withdrawal.rejected", withdrawalId: row.id });
      this.refreshBatch(row.batchId);
      return { ok: true, status: "REJECTED" };
    });
  }

  async listApproved(limit: number) {
    return this.exclusive(() =>
      this.withdrawals
        .filter((row) => row.status === "APPROVED" && row.batchId == null)
        .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())
        .slice(0, limit)
        .map((row) => this.snapshot(row)),
    );
  }

  async tryAdvanceGate(now: Date, gapMs: number) {
    return this.exclusive(() => {
      if (this.gate.getTime() > now.getTime()) return false;
      this.gate = new Date(now.getTime() + gapMs);
      return true;
    });
  }

  async claimApproved(ids: string[], at: Date) {
    return this.exclusive(() => {
      const claimed: WithdrawalSnapshot[] = [];
      for (const id of ids) {
        const row = this.withdrawals.find((item) => item.id === id && item.status === "APPROVED");
        if (!row) continue;
        row.status = "PROCESSING";
        row.processingAt = at;
        const attempt = this.attempts.find((item) => item.reference === row.reference);
        if (attempt) attempt.status = "PROCESSING";
        claimed.push(this.snapshot(row));
      }
      return claimed;
    });
  }

  async createBatch(input: { actorId: string; transferCount: number; message: string | null; submittedAt: Date; withdrawalIds: string[] }) {
    return this.exclusive(() => {
      const id = this.id();
      this.batches.push({
        id,
        status: "PREPARING",
        message: input.message,
        withdrawalIds: [...input.withdrawalIds],
        transferCount: input.transferCount,
        totalKobo: 0,
        totalPoints: 0,
        nairaPerUsd: null,
        rateAt: null,
        createdAt: input.submittedAt,
      });
      for (const withdrawalId of input.withdrawalIds) {
        const row = this.withdrawals.find((item) => item.id === withdrawalId);
        if (row) row.batchId = id;
      }
      this.audits.push({ action: "batch.submitted" });
      return { id };
    });
  }

  async createPendingBatch(input: {
    transferCount: number;
    totalPoints: number;
    totalKobo: number;
    nairaPerUsd: number | null;
    rateAt: Date | null;
    withdrawalIds: string[];
    actorId?: string | null;
  }) {
    return this.exclusive(() => {
      const rows = input.withdrawalIds.map((id) => this.withdrawals.find((item) => item.id === id));
      if (rows.length === 0 || rows.some((row) => !row || row.status !== "APPROVED" || row.batchId != null)) {
        return { ok: false as const, code: "conflict" as const };
      }
      const id = this.id();
      this.batches.push({
        id,
        status: "PENDING",
        message: null,
        withdrawalIds: [...input.withdrawalIds],
        transferCount: input.transferCount,
        totalKobo: input.totalKobo,
        totalPoints: input.totalPoints,
        nairaPerUsd: input.nairaPerUsd,
        rateAt: input.rateAt,
        createdAt: new Date(),
      });
      for (const row of rows) {
        if (row) row.batchId = id;
      }
      this.audits.push({
        action: input.actorId ? "batch.created" : "batch.enrolled",
        actorId: input.actorId ?? null,
        batchId: id,
        detail: `${input.transferCount} payouts, ${input.totalKobo} kobo`,
      });
      return { ok: true as const, id };
    });
  }

  async getBatch(id: string) {
    return this.exclusive(() => {
      const batch = this.batches.find((item) => item.id === id);
      if (!batch) return null;
      return {
        id: batch.id,
        status: batch.status,
        transferCount: batch.transferCount,
        totalKobo: batch.totalKobo,
        totalPoints: batch.totalPoints,
        withdrawalIds: this.withdrawals.filter((row) => row.batchId === batch.id).map((row) => row.id),
        createdAt: batch.createdAt,
      };
    });
  }

  async oldestPendingBatch() {
    return this.exclusive(() => {
      const batch = this.batches.find((item) => item.status === "PENDING");
      if (!batch) return null;
      return {
        id: batch.id,
        withdrawalIds: this.withdrawals.filter((row) => row.batchId === batch.id && row.status === "APPROVED").map((row) => row.id),
      };
    });
  }

  async detachUnclaimed(batchId: string, claimedIds: string[]) {
    return this.exclusive(() => {
      const claimed = new Set(claimedIds);
      for (const row of this.withdrawals) {
        if (row.batchId === batchId && row.status === "APPROVED" && !claimed.has(row.id)) row.batchId = null;
      }
    });
  }

  async updateBatch(id: string, input: { status: string; message: string | null; submittedAt?: Date }) {
    return this.exclusive(() => {
      const batch = this.batches.find((item) => item.id === id);
      if (!batch) return;
      batch.status = input.status;
      batch.message = input.message;
    });
  }

  async setTransferCode(reference: string, transferCode: string) {
    return this.exclusive(() => {
      const attempt = this.attempts.find((item) => item.reference === reference);
      if (attempt) attempt.transferCode = transferCode;
      const row = this.withdrawals.find((item) => item.reference === reference);
      if (row) row.transferCode = transferCode;
    });
  }

  async settle(input: {
    reference: string;
    verified: "success" | "failed" | "reversed";
    amountKobo: number | null;
    currency: string | null;
    transferCode: string | null;
    at: Date;
    actorId?: string | null;
  }): Promise<SettleResult> {
    return this.exclusive(() => {
      const attempt = this.attempts.find((item) => item.reference === input.reference);
      const row = attempt ? this.withdrawals.find((item) => item.id === attempt.withdrawalId) : undefined;
      if (!row) return "ignored";
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
        row.anomaly = decision.anomaly;
        return "anomaly";
      }
      const user = this.users.get(row.userId);
      if (!user) return "anomaly";
      if (decision.type === "pay") {
        if (row.status !== "PROCESSING" || user.reservedUnits < row.points || user.availableUnits < row.points) return "anomaly";
        row.status = "PAID";
        row.completedAt = input.at;
        row.transferCode = input.transferCode;
        user.availableUnits -= row.points;
        user.reservedUnits -= row.points;
        this.markLedger(row.reference, "PAID", -row.points);
        if (attempt) {
          attempt.status = "PAID";
          attempt.transferCode = input.transferCode;
        }
        this.refreshBatch(row.batchId);
        this.audits.push({ action: "withdrawal.paid", actorId: input.actorId ?? null, withdrawalId: row.id, batchId: row.batchId ?? undefined, detail: input.reference });
        return "paid";
      }
      if (decision.type === "fail") {
        if (!this.release(row, input.at, decision.reason, "FAILED")) return "anomaly";
        if (attempt) attempt.status = "FAILED";
        this.refreshBatch(row.batchId);
        this.audits.push({ action: "withdrawal.failed", actorId: input.actorId ?? null, withdrawalId: row.id, batchId: row.batchId ?? undefined, detail: input.reference });
        return "failed";
      }
      if (decision.type === "reverse-paid") {
        if (row.status !== "PAID") return "ignored";
        if (this.ledger.some((item) => item.providerTxId === `${row.reference}:reversal`)) return "ignored";
        row.status = "REVERSED";
        row.completedAt = input.at;
        user.availableUnits += row.points;
        const original = this.ledger.find((item) => item.providerTxId === row.reference);
        this.ledger.push({
          userId: row.userId,
          providerTxId: `${row.reference}:reversal`,
          status: "REVERSED",
          appliedUnits: row.points,
          type: "WITHDRAWAL_REVERSAL",
          currencyCode: original?.currencyCode ?? "PTS",
        });
        if (attempt) attempt.status = "REVERSED";
        this.refreshBatch(row.batchId);
        this.audits.push({ action: "withdrawal.reversed", actorId: input.actorId ?? null, withdrawalId: row.id, batchId: row.batchId ?? undefined, detail: input.reference });
        return "reversed";
      }
      if (user.reservedUnits < row.points || row.status !== "PROCESSING") return "anomaly";
      row.status = "REVERSED";
      row.completedAt = input.at;
      user.reservedUnits -= row.points;
      this.markLedger(row.reference, "REVERSED", 0);
      if (attempt) attempt.status = "REVERSED";
      this.refreshBatch(row.batchId);
      this.audits.push({ action: "withdrawal.reversed", actorId: input.actorId ?? null, withdrawalId: row.id, batchId: row.batchId ?? undefined, detail: input.reference });
      return "reversed";
    });
  }

  async releaseUnsent(input: { reference: string; at: Date; reason: string }): Promise<SettleResult> {
    return this.exclusive(() => {
      const row = this.withdrawals.find((item) => item.reference === input.reference && item.status === "PROCESSING");
      if (!row) return "ignored";
      if (!this.release(row, input.at, input.reason, "FAILED")) return "anomaly";
      const attempt = this.attempts.find((item) => item.reference === input.reference);
      if (attempt) attempt.status = "FAILED";
      this.refreshBatch(row.batchId);
      this.audits.push({ action: "withdrawal.failed", actorId: null, withdrawalId: row.id, batchId: row.batchId ?? undefined, detail: input.reference });
      return "failed";
    });
  }

  async beginRetry(input: {
    withdrawalId: string;
    actorId: string;
    reference: string;
    minimumKobo: number;
    currencyCode: string;
    at: Date;
  }): Promise<RetryResult> {
    return this.exclusive(() => {
      if (this.references.has(input.reference)) return { ok: false, code: "duplicate_reference" };
      const row = this.withdrawals.find((item) => item.id === input.withdrawalId);
      if (!row) return { ok: false, code: "missing" };
      if (row.status !== "FAILED") return { ok: false, code: "not_failed" };
      const user = this.users.get(row.userId);
      const open = this.withdrawals.some(
        (item) => item.userId === row.userId && item.id !== row.id && (OPEN_WITHDRAWAL_STATUSES as readonly string[]).includes(item.status),
      );
      const plan = planRequest({
        hasAccount: Boolean(user?.payout),
        availableUnits: user?.availableUnits ?? 0,
        reservedUnits: user?.reservedUnits ?? 0,
        openWithdrawal: open,
        points: row.points,
        amountKobo: row.amountKobo,
        minimumKobo: input.minimumKobo,
      });
      if (!plan.ok || !user?.payout) {
        if (plan.ok) return { ok: false as const, code: "no_account" as const };
        if (plan.code === "invalid_amount" || plan.code === "below_minimum") return { ok: false as const, code: "conflict" as const };
        return { ok: false as const, code: plan.code };
      }
      user.reservedUnits += row.points;
      row.reference = input.reference;
      row.recipientCode = user.payout.recipientCode;
      row.status = "APPROVED";
      row.attempt += 1;
      row.failureReason = null;
      row.transferCode = null;
      row.batchId = null;
      row.processingAt = null;
      row.completedAt = null;
      row.anomaly = null;
      row.reviewedAt = input.at;
      row.reviewedBy = input.actorId;
      this.references.add(input.reference);
      this.attempts.push({ withdrawalId: row.id, reference: input.reference, status: "RESERVED", transferCode: null, createdAt: input.at });
      this.ledger.push({
        userId: row.userId,
        providerTxId: input.reference,
        status: "RESERVED",
        appliedUnits: 0,
        type: "WITHDRAWAL",
        currencyCode: input.currencyCode,
      });
      this.audits.push({ action: "withdrawal.retry", withdrawalId: row.id });
      return { ok: true, reference: input.reference };
    });
  }

  async setAnomaly(withdrawalId: string, anomaly: string) {
    return this.exclusive(() => {
      const row = this.withdrawals.find((item) => item.id === withdrawalId);
      if (row) row.anomaly = anomaly.slice(0, 300);
    });
  }

  async findEvent(eventKey: string) {
    return this.exclusive(() => {
      const event = this.events.get(eventKey);
      return event ? { processedAt: event.processedAt } : null;
    });
  }

  async createEvent(input: { eventKey: string; event: string; reference: string | null }) {
    return this.exclusive(() => {
      if (this.events.has(input.eventKey)) return "exists" as const;
      this.events.set(input.eventKey, { event: input.event, reference: input.reference, processedAt: null, note: null });
      return "created" as const;
    });
  }

  async markEventProcessed(eventKey: string, note: string | null) {
    return this.exclusive(() => {
      const event = this.events.get(eventKey);
      if (!event) return;
      event.processedAt = new Date();
      event.note = note;
    });
  }

  async recordAudit(input: { actorId: string | null; action: string; withdrawalId?: string; batchId?: string; detail?: string }) {
    return this.exclusive(() => {
      this.audits.push({
        action: input.action,
        actorId: input.actorId,
        withdrawalId: input.withdrawalId,
        batchId: input.batchId,
        detail: input.detail,
      });
    });
  }

  private refreshBatch(batchId: string | null): void {
    if (!batchId) return;
    const batch = this.batches.find((item) => item.id === batchId);
    if (!batch) return;
    const statuses = this.withdrawals.filter((row) => row.batchId === batchId).map((row) => row.status);
    const next = deriveBatchStatus(statuses, batch.status);
    if (next) batch.status = next;
  }

  private release(row: WithdrawalRow, at: Date, reason: string, status: "FAILED" | "REJECTED"): boolean {
    const user = this.users.get(row.userId);
    if (!user || user.reservedUnits < row.points) return false;
    if (!(OPEN_WITHDRAWAL_STATUSES as readonly string[]).includes(row.status)) return false;
    user.reservedUnits -= row.points;
    row.status = status;
    row.failureReason = reason.slice(0, 300);
    row.completedAt = at;
    this.markLedger(row.reference, "RELEASED", 0);
    return true;
  }

  private markLedger(reference: string, status: string, appliedUnits: number): void {
    const row = this.ledger.find((item) => item.providerTxId === reference && item.type === "WITHDRAWAL");
    if (!row) return;
    row.status = status;
    row.appliedUnits = appliedUnits;
  }
}

