import type { WithdrawalStatus } from "@/lib/payouts/constants";

export type RequestDenial = "no_account" | "below_minimum" | "open_withdrawal" | "insufficient" | "invalid_amount";

export function planRequest(input: {
  hasAccount: boolean;
  availableUnits: number;
  reservedUnits: number;
  openWithdrawal: boolean;
  points: number;
  amountKobo: number;
  minimumKobo: number;
}): { ok: true } | { ok: false; code: RequestDenial } {
  if (!input.hasAccount) return { ok: false, code: "no_account" };
  if (!Number.isInteger(input.points) || input.points < 1) return { ok: false, code: "invalid_amount" };
  if (!Number.isInteger(input.amountKobo) || input.amountKobo < 1) return { ok: false, code: "invalid_amount" };
  if (input.amountKobo < input.minimumKobo) return { ok: false, code: "below_minimum" };
  if (input.openWithdrawal) return { ok: false, code: "open_withdrawal" };
  if (input.availableUnits < 0 || input.reservedUnits < 0) return { ok: false, code: "insufficient" };
  if (input.points > input.availableUnits - input.reservedUnits) return { ok: false, code: "insufficient" };
  return { ok: true };
}

export type SettlementDecision =
  | { type: "ignore" }
  | { type: "anomaly"; anomaly: string }
  | { type: "pay" }
  | { type: "fail"; reason: string }
  | { type: "reverse-paid" }
  | { type: "reverse-processing" };

export function settlementFacts(input: {
  verified: "success" | "failed" | "reversed";
  amountKobo: number | null;
  currency: string | null;
  expectedKobo: number;
}): { amountMatches: boolean; currencyMatches: boolean } {
  const currencyMatches = input.verified === "failed" && input.currency == null ? true : input.currency === "NGN";
  const amountMatches =
    input.verified === "failed"
      ? input.amountKobo == null || input.amountKobo === input.expectedKobo
      : input.amountKobo === input.expectedKobo;
  return { amountMatches, currencyMatches };
}

export function decideSettlement(input: {
  status: WithdrawalStatus;
  currentReference: string;
  eventReference: string;
  verified: "success" | "failed" | "reversed";
  amountMatches: boolean;
  currencyMatches: boolean;
}): SettlementDecision {
  if (input.eventReference !== input.currentReference) {
    return { type: "anomaly", anomaly: `Stale transfer reference reported ${input.verified}.` };
  }
  if (!input.amountMatches || !input.currencyMatches) {
    return { type: "anomaly", anomaly: "Provider amount or currency did not match this withdrawal." };
  }

  if (input.verified === "success") {
    if (input.status === "PAID") return { type: "ignore" };
    if (input.status === "PROCESSING") return { type: "pay" };
    return { type: "anomaly", anomaly: `Success reported while withdrawal was ${input.status}.` };
  }

  if (input.verified === "failed") {
    if (input.status === "FAILED" || input.status === "REJECTED") return { type: "ignore" };
    if (input.status === "PROCESSING") return { type: "fail", reason: "Paystack reported the transfer as failed." };
    return { type: "anomaly", anomaly: `Failure reported while withdrawal was ${input.status}.` };
  }

  if (input.status === "REVERSED") return { type: "ignore" };
  if (input.status === "PAID") return { type: "reverse-paid" };
  if (input.status === "PROCESSING") return { type: "reverse-processing" };
  return { type: "anomaly", anomaly: `Reversal reported while withdrawal was ${input.status}.` };
}

export function canApprove(status: WithdrawalStatus): boolean {
  return status === "PENDING" || status === "UNDER_REVIEW";
}

export function canReject(status: WithdrawalStatus): boolean {
  return status === "PENDING" || status === "UNDER_REVIEW" || status === "APPROVED";
}
