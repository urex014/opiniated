import type { PaystackClient } from "@/lib/paystack/client";
import type { PaystackKeyMode } from "@/lib/paystack/mode";
import type { PayoutCandidate } from "@/lib/payouts/enroll";
import type { PayoutRepository } from "@/lib/payouts/repository";

export type FxPolicy = { nairaPerUsd: number; effectiveAt: Date; expiresAt: Date };

export type ScheduleState = {
  intervalDays: number;
  minUsdCents: number;
  nextRunAt: Date;
  paused: boolean;
  lockedUntil: Date;
};

export interface AutoPayoutStore {
  tryLock(now: Date, holdMs: number): Promise<ScheduleState | null>;
  finishLock(nextRunAt: Date | null): Promise<void>;
  activeFx(now: Date): Promise<FxPolicy | null>;
  listCandidates(minUsdCents: number, limit: number): Promise<PayoutCandidate[]>;
}

export type CycleResult = {
  status: "disabled" | "locked" | "paused" | "waiting" | "currency" | "no_rate" | "enrolled" | "submitted" | "idle";
  enrolled: number;
  submitted: number;
};

/**
 * Scheduled payouts do not reserve balances and do not call Paystack.
 * An admin creates a batch and confirms Release Batch before any transfer.
 */
export async function runAutoPayout(input: {
  store: AutoPayoutStore;
  repo: PayoutRepository;
  client: PaystackClient | null;
  now: Date;
  currencyCode: string;
  minimumKobo: number;
  transfersEnabled: boolean;
  liveConfirmed: boolean;
  keyMode: PaystackKeyMode;
  feeBufferKobo: number;
  referenceFor: (userId: string) => string;
}): Promise<CycleResult> {
  void input;
  return { status: "disabled", enrolled: 0, submitted: 0 };
}
