import { minimumPoints, pointsToKobo } from "@/lib/payouts/money";
import { openingStatus, riskFlags } from "@/lib/payouts/risk";
import { createWithdrawalReference } from "@/lib/payouts/reference";
import type { PayoutRepository } from "@/lib/payouts/repository";

export async function requestUserWithdrawal(
  repo: PayoutRepository,
  input: {
    userId: string;
    points: number;
    koboPerPoint: number | null;
    minimumKobo: number;
    currencyCode: string;
    now: Date;
    reference?: string;
  },
): Promise<{ error?: string; message?: string }> {
  if (input.koboPerPoint == null) {
    return {
      error:
        input.currencyCode === "OPN"
          ? "100 OPN equal $1.00. Set a whole-naira price per dollar before requesting a withdrawal."
          : "Withdrawals are unavailable until a points-to-naira rate is configured.",
    };
  }
  const amountKobo = pointsToKobo(input.points, input.koboPerPoint);
  if (amountKobo == null) return { error: "Enter a whole number of points." };
  const minimum = minimumPoints(input.minimumKobo, input.koboPerPoint);
  if (minimum != null && input.points < minimum) {
    return { error: `The minimum withdrawal is ${minimum} points.` };
  }
  const [account, balance, paidCount] = await Promise.all([
    repo.getPayoutAccount(input.userId),
    repo.getBalance(input.userId),
    repo.countPaid(input.userId),
  ]);
  const spendable = Math.max(0, (balance?.availableUnits ?? 0) - (balance?.reservedUnits ?? 0));
  const flags = riskFlags({
    points: input.points,
    spendableBefore: spendable,
    accountUpdatedAt: account?.updatedAt ?? null,
    paidCount,
    now: input.now,
  });
  const result = await repo.requestWithdrawal({
    userId: input.userId,
    points: input.points,
    amountKobo,
    minimumKobo: input.minimumKobo,
    reference: input.reference ?? createWithdrawalReference(1),
    status: openingStatus(flags),
    currencyCode: input.currencyCode,
    at: input.now,
  });
  if (!result.ok) return { error: requestError(result.code, minimum) };
  return {
    message: "Withdrawal requested. The points are reserved. This is not a payment until Paystack confirms the transfer.",
  };
}

function requestError(code: string, minimum: number | null): string {
  if (code === "no_account") return "Save a verified bank account before requesting a withdrawal.";
  if (code === "below_minimum") return `The minimum withdrawal is ${minimum ?? "the configured"} points.`;
  if (code === "open_withdrawal") return "You already have a withdrawal in progress.";
  if (code === "insufficient") return "That amount is higher than the balance available to withdraw.";
  if (code === "invalid_amount") return "Enter a whole number of points.";
  if (code === "conflict") return "The balance changed. Check the amount and try again.";
  return "The withdrawal could not be requested.";
}
