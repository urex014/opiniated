import "server-only";

import { prisma } from "@/lib/db";
import { OPEN_WITHDRAWAL_STATUSES } from "@/lib/payouts/constants";
import { evaluateEligibility } from "@/lib/payouts/eligibility";
import { eligibilityLabel } from "@/lib/payouts/labels";
import { isSendablePayout } from "@/lib/payouts/processor";
import { riskFlags } from "@/lib/payouts/risk";
import { heldUserIds } from "@/lib/risk/persist";
import { formatReward } from "@/lib/rewards/money";

const REVIEW_CAP = 50;

export type RecipientView = {
  userId: string;
  email: string;
  bank: string;
  points: string;
  amount: string;
  eligibility: string;
  hold: string;
  flags: string[];
};

export type BatchView = {
  id: string;
  status: string;
  createdAt: string;
  count: number;
  totalKobo: number;
  totalLabel: string;
  message: string;
  releasable: boolean;
  rows: { id: string; email: string; amount: string; bank: string; result: string; flags: string[] }[];
};

export async function loadAdminPayoutBoard(input: {
  now: Date;
  currencyCode: string;
  factor: number;
  minUsdCents: number;
  minimumKobo: number;
  nairaPerUsd: number | null;
  rateExpiresAt: Date | null;
}): Promise<{ recipients: RecipientView[]; batches: BatchView[] }> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, payoutAccount: { isNot: null } },
    include: {
      payoutAccount: true,
      rewardAccount: true,
      withdrawals: { where: { status: { in: [...OPEN_WITHDRAWAL_STATUSES] } }, select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const ranked = users
    .map((user) => {
      const available = user.rewardAccount?.availableUnits ?? 0;
      const reserved = user.rewardAccount?.reservedUnits ?? 0;
      return { user, spendable: available - reserved };
    })
    .sort((left, right) => right.spendable - left.spendable)
    .slice(0, REVIEW_CAP);
  const ids = ranked.map((row) => row.user.id);
  const [held, paidRows, batches] = await Promise.all([
    heldUserIds(ids),
    prisma.withdrawal.findMany({ where: { userId: { in: ids }, status: { in: ["PAID", "REVERSED"] } }, select: { userId: true } }),
    prisma.payoutBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        withdrawals: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                email: true,
                payoutAccount: { select: { bankName: true, accountLast4: true, accountName: true, updatedAt: true } },
                rewardAccount: { select: { availableUnits: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  const paidCount = new Map<string, number>();
  for (const row of paidRows) paidCount.set(row.userId, (paidCount.get(row.userId) ?? 0) + 1);
  const recipients = ranked.map(({ user }) => {
    const account = user.payoutAccount;
    const available = user.rewardAccount?.availableUnits ?? 0;
    const reserved = user.rewardAccount?.reservedUnits ?? 0;
    const payoutHeld = held.has(user.id);
    const decision = evaluateEligibility({
      deletedAt: user.deletedAt,
      availableUnits: available,
      reservedUnits: reserved,
      accountUpdatedAt: account?.updatedAt ?? null,
      recipientCode: account?.recipientCode ?? null,
      openWithdrawal: user.withdrawals.length > 0,
      currencyCode: input.currencyCode,
      nairaPerUsd: input.nairaPerUsd,
      rateExpiresAt: input.rateExpiresAt,
      now: input.now,
      minUsdCents: input.minUsdCents,
      minimumKobo: input.minimumKobo,
      payoutHeld,
    });
    const spendable = Math.max(0, available - reserved);
    const flags = riskFlags({
      points: decision.ok ? decision.points : spendable,
      spendableBefore: available,
      accountUpdatedAt: account?.updatedAt ?? null,
      paidCount: paidCount.get(user.id) ?? 0,
      now: input.now,
    });
    return {
      userId: user.id,
      email: user.email,
      bank: bankLabel(account),
      points: formatReward(decision.ok ? decision.points : spendable, input.currencyCode, input.factor),
      amount: formatReward(decision.ok ? decision.amountKobo : 0, "NGN", 100),
      eligibility: decision.ok ? "Eligible" : eligibilityLabel(decision.reason),
      hold: holdLabel(payoutHeld, decision.ok ? null : decision.reason),
      flags,
    };
  });
  return {
    recipients,
    batches: batches.map((batch) => {
      const ready = batch.withdrawals.filter((row) => row.status === "APPROVED" && isSendablePayout(row));
      const totalKobo = ready.reduce((sum, row) => sum + row.amountKobo, 0);
      return {
        id: batch.id,
        status: batch.status,
        createdAt: batch.createdAt.toISOString(),
        count: ready.length,
        totalKobo,
        totalLabel: formatReward(totalKobo, "NGN", 100),
        message: batch.message ?? "No provider message.",
        releasable: batch.status === "PENDING" && ready.length > 0,
        rows: batch.withdrawals.map((row) => ({
          id: row.id,
          email: row.user.email,
          amount: formatReward(row.amountKobo, "NGN", 100),
          bank: bankLabel(row.user.payoutAccount),
          result: transferResult(row.status, row.transferCode, row.failureReason),
          flags: riskFlags({
            points: row.points,
            spendableBefore: row.user.rewardAccount?.availableUnits ?? row.points,
            accountUpdatedAt: row.user.payoutAccount?.updatedAt ?? null,
            paidCount: paidCount.get(row.userId) ?? 0,
            now: input.now,
          }),
        })),
      };
    }),
  };
}

function bankLabel(account: { bankName: string; accountLast4: string; accountName: string } | null | undefined): string {
  if (!account) return "No verified bank account";
  return `${account.bankName} ending ${account.accountLast4}, ${account.accountName}`;
}

function holdLabel(payoutHeld: boolean, reason: string | null): string {
  if (payoutHeld || reason === "payout_review") return "Payout hold";
  if (reason === "bank_recent") return "24-hour bank hold";
  if (reason === "below_threshold") return "Below minimum balance";
  return "None";
}

function transferResult(status: string, transferCode: string | null, failureReason: string | null): string {
  const parts = [status];
  if (transferCode) parts.push(transferCode);
  if (failureReason) parts.push(failureReason);
  if (status === "PROCESSING") parts.push("pending until Paystack confirms");
  if (status === "PAID") parts.push("confirmed");
  return parts.join(" · ");
}
