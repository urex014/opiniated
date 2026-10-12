import { pointsToKobo } from "@/lib/payouts/money";

/**
 * Currency policy for automatic payouts.
 *
 * The ledger stores whole OPN. 100 OPN equal $1.00, so one OPN is one US cent.
 * The provider user reward is parsed with REWARD_MINOR_UNIT_FACTOR. With factor
 * 100, a provider dollar amount becomes that many OPN. This is the app's reward peg.
 * It is not a claim that publisher revenue is the same number.
 *
 * A payout pays the full spendable confirmed balance once it is at least the
 * configured dollar threshold (default 500 cents). Balances below the threshold
 * stay entirely unreserved. There is no partial slice and no fractional kobo:
 * kobo = OPN × whole naira per dollar, both integers.
 *
 * The naira rate comes from an unexpired PayoutFxPolicy row, and that rate and
 * its effective time are copied onto the withdrawal. A later rate change does
 * not reprice a reserved payout. OPN left in the account exists only while the
 * spendable balance is still under the threshold.
 *
 * Other ledger currencies are not converted. Email verification does not gate
 * payouts. A deleted account cannot be paid. A bank saved or replaced in the
 * last 24 hours waits until that revalidation window has passed. Confirmed
 * rewards are availableUnits. Pending survey completions are not in that figure.
 */

export const DEFAULT_MIN_USD_CENTS = 500;
export const BANK_HOLD_MS = 24 * 60 * 60 * 1000;
export const PAYSTACK_MIN_KOBO = 5_000;
export const PAYSTACK_MAX_KOBO = 1_000_000_000;
export const FX_MAX_DAYS = 30;

export type EligibilityReason =
  | "deleted"
  | "currency"
  | "no_bank"
  | "bank_recent"
  | "open_withdrawal"
  | "below_threshold"
  | "no_rate"
  | "rate_expired"
  | "below_paystack_min"
  | "above_paystack_max"
  | "payout_review"
  | "invalid";

export type EligibilityInput = {
  deletedAt: Date | null;
  availableUnits: number;
  reservedUnits: number;
  accountUpdatedAt: Date | null;
  recipientCode: string | null;
  openWithdrawal: boolean;
  currencyCode: string;
  nairaPerUsd: number | null;
  rateExpiresAt: Date | null;
  now: Date;
  minUsdCents: number;
  minimumKobo: number;
  /** Open payout review. The balance stays; it is not reserved. */
  payoutHeld?: boolean;
};

export type Eligibility =
  | { ok: true; points: number; amountKobo: number; usdCents: number; nairaPerUsd: number }
  | { ok: false; reason: EligibilityReason };

export function evaluateEligibility(input: EligibilityInput): Eligibility {
  if (input.deletedAt) return { ok: false, reason: "deleted" };
  if (input.payoutHeld) return { ok: false, reason: "payout_review" };
  if (input.currencyCode !== "OPN") return { ok: false, reason: "currency" };
  if (!input.recipientCode?.startsWith("RCP_")) return { ok: false, reason: "no_bank" };
  if (!input.accountUpdatedAt || input.now.getTime() - input.accountUpdatedAt.getTime() < BANK_HOLD_MS) {
    return { ok: false, reason: "bank_recent" };
  }
  if (input.openWithdrawal) return { ok: false, reason: "open_withdrawal" };
  if (!Number.isInteger(input.minUsdCents) || input.minUsdCents < 1) return { ok: false, reason: "invalid" };
  const spendable = input.availableUnits - input.reservedUnits;
  if (!Number.isInteger(input.availableUnits) || !Number.isInteger(input.reservedUnits) || spendable < 1) {
    return { ok: false, reason: "below_threshold" };
  }
  if (spendable < input.minUsdCents) return { ok: false, reason: "below_threshold" };
  if (input.nairaPerUsd == null) return { ok: false, reason: "no_rate" };
  if (!input.rateExpiresAt || input.rateExpiresAt.getTime() <= input.now.getTime()) {
    return { ok: false, reason: "rate_expired" };
  }
  const amountKobo = pointsToKobo(spendable, input.nairaPerUsd);
  if (amountKobo == null) return { ok: false, reason: "above_paystack_max" };
  const floor = Math.max(input.minimumKobo, PAYSTACK_MIN_KOBO);
  if (amountKobo < floor) return { ok: false, reason: "below_paystack_min" };
  if (amountKobo > PAYSTACK_MAX_KOBO) return { ok: false, reason: "above_paystack_max" };
  return { ok: true, points: spendable, amountKobo, usdCents: spendable, nairaPerUsd: input.nairaPerUsd };
}

export function formatUsdFromCents(cents: number): string {
  if (!Number.isInteger(cents)) return "$0.00";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const remainder = abs % 100;
  return `${negative ? "-" : ""}$${dollars.toString()}.${remainder.toString().padStart(2, "0")}`;
}

export type NoticeInput = {
  hasVerifiedBank: boolean;
  bankReady: boolean;
  phase: "none" | "scheduled" | "processing" | "paid";
  spendableUnits: number;
  minUsdCents: number;
  currencyCode: string;
  aboveTransferMax: boolean;
  belowTransferMin: boolean;
};

export function payoutNotice(input: NoticeInput): string {
  if (!input.hasVerifiedBank) return "Connect and verify your bank account to receive payouts automatically.";
  if (!input.bankReady) return "Your bank account is saved. Automatic payouts use it after it has been on the account for 24 hours.";
  if (input.phase === "processing") return "Your payout is being processed.";
  if (input.phase === "scheduled") return "Your payout has been included in an upcoming batch.";
  if (input.aboveTransferMax) return "Your balance is above the amount one transfer can send. It stays in your account for review.";
  if (input.belowTransferMin) return "The naira value of this balance is below the transfer minimum. It stays in your account.";
  if (input.currencyCode === "OPN" && input.spendableUnits >= input.minUsdCents) {
    return "You're eligible for the next payout batch. No action is required.";
  }
  if (input.phase === "paid" && input.spendableUnits === 0) return "Your payout has been completed.";
  if (input.currencyCode !== "OPN") return "Automatic payouts run when the balance is Opiniated Points.";
  const shortfall = Math.max(0, input.minUsdCents - Math.max(0, input.spendableUnits));
  return `You need ${formatUsdFromCents(shortfall)} more to qualify for a payout.`;
}

export function payoutProgress(spendableUnits: number, minUsdCents: number): number {
  if (!Number.isInteger(spendableUnits) || !Number.isInteger(minUsdCents) || minUsdCents < 1 || spendableUnits < 1) return 0;
  return Math.min(100, Math.floor((spendableUnits * 100) / minUsdCents));
}
