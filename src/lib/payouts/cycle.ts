import type { PaystackClient } from "@/lib/paystack/client";
import type { PaystackKeyMode } from "@/lib/paystack/mode";
import { BATCH_LIMIT } from "@/lib/payouts/constants";
import { enrollEligible, type PayoutCandidate } from "@/lib/payouts/enroll";
import { submitPendingBatch } from "@/lib/payouts/processor";
import type { PayoutRepository, WithdrawalSnapshot } from "@/lib/payouts/repository";

const HOLD_MS = 120_000;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  status: "locked" | "paused" | "waiting" | "currency" | "no_rate" | "enrolled" | "submitted" | "idle";
  enrolled: number;
  submitted: number;
};

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
  const locked = await input.store.tryLock(input.now, HOLD_MS);
  if (!locked) return { status: "locked", enrolled: 0, submitted: 0 };
  let nextRunAt: Date | null = null;
  let enrolled = 0;
  let submitted = 0;
  let attempted = false;
  const submit = async () => {
    if (attempted || !input.transfersEnabled || !input.client) return;
    const result = await submitPendingBatch({
      repo: input.repo,
      client: input.client,
      now: input.now,
      transfersEnabled: input.transfersEnabled,
      liveConfirmed: input.liveConfirmed,
      keyMode: input.keyMode,
      feeBufferKobo: input.feeBufferKobo,
      actorId: "schedule",
    });
    if (result.code !== "empty") attempted = true;
    if (result.ok) submitted = result.count;
  };
  try {
    if (locked.paused) return { status: "paused", enrolled: 0, submitted: 0 };
    await submit();
    if (input.now.getTime() < locked.nextRunAt.getTime()) {
      return { status: submitted > 0 ? "submitted" : "waiting", enrolled: 0, submitted };
    }
    const loose = await input.repo.listApproved(BATCH_LIMIT);
    if (loose.length > 0) await groupReserved(input.repo, loose);
    await submit();
    if (input.currencyCode !== "OPN") return { status: "currency", enrolled: 0, submitted };
    const fx = await input.store.activeFx(input.now);
    if (!fx) return { status: "no_rate", enrolled: 0, submitted };
    const candidates = await input.store.listCandidates(locked.minUsdCents, BATCH_LIMIT);
    const rows = await enrollEligible({
      repo: input.repo,
      candidates,
      currencyCode: input.currencyCode,
      nairaPerUsd: fx.nairaPerUsd,
      rateAt: fx.effectiveAt,
      rateExpiresAt: fx.expiresAt,
      now: input.now,
      minUsdCents: locked.minUsdCents,
      minimumKobo: input.minimumKobo,
      referenceFor: input.referenceFor,
    });
    if (rows.length > 0) {
      const grouped = await groupReserved(input.repo, rows);
      if (!grouped) return { status: "enrolled", enrolled: rows.length, submitted };
      enrolled = rows.length;
    }
    await submit();
    const overflow = rows.length === BATCH_LIMIT;
    nextRunAt = overflow ? input.now : new Date(input.now.getTime() + locked.intervalDays * DAY_MS);
    if (submitted > 0) return { status: "submitted", enrolled, submitted };
    if (enrolled > 0) return { status: "enrolled", enrolled, submitted };
    return { status: "idle", enrolled: 0, submitted };
  } finally {
    await input.store.finishLock(nextRunAt);
  }
}

async function groupReserved(repo: PayoutRepository, rows: WithdrawalSnapshot[]): Promise<boolean> {
  const created = await repo.createPendingBatch({
    transferCount: rows.length,
    totalPoints: rows.reduce((sum, row) => sum + row.points, 0),
    totalKobo: rows.reduce((sum, row) => sum + row.amountKobo, 0),
    nairaPerUsd: rows[0]?.nairaPerUsd ?? null,
    rateAt: rows[0]?.rateAt ?? null,
    withdrawalIds: rows.map((row) => row.id),
  });
  return created.ok;
}
