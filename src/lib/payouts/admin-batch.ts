import type { PaystackClient } from "@/lib/paystack/client";
import type { PaystackKeyMode } from "@/lib/paystack/mode";
import type { AutoPayoutStore } from "@/lib/payouts/cycle";
import { BATCH_LIMIT } from "@/lib/payouts/constants";
import { enrollEligible } from "@/lib/payouts/enroll";
import { submitConfirmedBatch, type BatchSubmitResult } from "@/lib/payouts/processor";
import type { PayoutRepository, WithdrawalSnapshot } from "@/lib/payouts/repository";

const HOLD_MS = 120_000;

export type PrepareResult = {
  status: "forbidden" | "locked" | "currency" | "no_rate" | "enrolled" | "idle" | "conflict";
  enrolled: number;
  batchIds: string[];
  totalKobo: number;
};

export async function prepareAdminBatch(input: {
  admin: boolean;
  store: AutoPayoutStore;
  repo: PayoutRepository;
  now: Date;
  currencyCode: string;
  minimumKobo: number;
  minUsdCents: number;
  actorId: string;
  referenceFor: (userId: string) => string;
}): Promise<PrepareResult> {
  if (!input.admin) {
    await input.repo.recordAudit({ actorId: input.actorId, action: "batch.create_rejected", detail: "forbidden" });
    return { status: "forbidden", enrolled: 0, batchIds: [], totalKobo: 0 };
  }
  const locked = await input.store.tryLock(input.now, HOLD_MS);
  if (!locked) return { status: "locked", enrolled: 0, batchIds: [], totalKobo: 0 };
  const batchIds: string[] = [];
  let enrolled = 0;
  let totalKobo = 0;
  try {
    const loose = await input.repo.listApproved(BATCH_LIMIT);
    const looseBatch = await group(input.repo, loose, input.actorId);
    if (looseBatch) addBatch(batchIds, loose, looseBatch.id, (value) => (enrolled += value), (value) => (totalKobo += value));
    if (input.currencyCode !== "OPN") return finish(batchIds, enrolled, totalKobo, "currency");
    const fx = await input.store.activeFx(input.now);
    if (!fx) return finish(batchIds, enrolled, totalKobo, "no_rate");
    const rows = await enrollEligible({
      repo: input.repo,
      candidates: await input.store.listCandidates(input.minUsdCents, BATCH_LIMIT),
      currencyCode: input.currencyCode,
      nairaPerUsd: fx.nairaPerUsd,
      rateAt: fx.effectiveAt,
      rateExpiresAt: fx.expiresAt,
      now: input.now,
      minUsdCents: input.minUsdCents,
      minimumKobo: input.minimumKobo,
      referenceFor: input.referenceFor,
    });
    const created = await group(input.repo, rows, input.actorId);
    if (rows.length > 0 && !created) return { status: "conflict", enrolled, batchIds, totalKobo };
    if (created) addBatch(batchIds, rows, created.id, (value) => (enrolled += value), (value) => (totalKobo += value));
    if (batchIds.length === 0) return { status: "idle", enrolled: 0, batchIds, totalKobo: 0 };
    return { status: "enrolled", enrolled, batchIds, totalKobo };
  } finally {
    await input.store.finishLock(null);
  }
}

export async function releaseAdminBatch(input: {
  admin: boolean;
  paused: boolean;
  repo: PayoutRepository;
  client: PaystackClient;
  batchId: string;
  confirmCount: number;
  confirmKobo: number;
  actorId: string;
  now: Date;
  transfersEnabled: boolean;
  liveConfirmed: boolean;
  keyMode: PaystackKeyMode;
  feeBufferKobo: number;
}): Promise<BatchSubmitResult> {
  if (!input.admin) {
    await input.repo.recordAudit({ actorId: input.actorId, action: "batch.release_rejected", batchId: input.batchId, detail: "forbidden" });
    return { ok: false, code: "forbidden", message: "You do not have access to payout administration.", batchId: input.batchId };
  }
  if (input.paused) {
    await input.repo.recordAudit({ actorId: input.actorId, action: "batch.release_rejected", batchId: input.batchId, detail: "paused" });
    return { ok: false, code: "disabled", message: "Batch release is paused.", batchId: input.batchId };
  }
  const result = await submitConfirmedBatch(
    {
      repo: input.repo,
      client: input.client,
      now: input.now,
      transfersEnabled: input.transfersEnabled,
      liveConfirmed: input.liveConfirmed,
      keyMode: input.keyMode,
      feeBufferKobo: input.feeBufferKobo,
      actorId: input.actorId,
    },
    { batchId: input.batchId, confirmCount: input.confirmCount, confirmKobo: input.confirmKobo },
  );
  if (result.code !== "confirmation_mismatch") {
    await input.repo.recordAudit({
      actorId: input.actorId,
      action: result.ok ? "batch.released" : "batch.release_rejected",
      batchId: result.batchId ?? input.batchId,
      detail: result.ok ? `queued ${result.count}; not paid` : `${result.code}: ${result.message}`,
    });
  }
  return result;
}

function finish(batchIds: string[], enrolled: number, totalKobo: number, emptyStatus: "currency" | "no_rate"): PrepareResult {
  if (batchIds.length > 0) return { status: "enrolled", enrolled, batchIds, totalKobo };
  return { status: emptyStatus, enrolled, batchIds, totalKobo };
}

async function group(repo: PayoutRepository, rows: WithdrawalSnapshot[], actorId: string): Promise<{ id: string } | null> {
  if (rows.length === 0) return null;
  const created = await repo.createPendingBatch({
    transferCount: rows.length,
    totalPoints: rows.reduce((sum, row) => sum + row.points, 0),
    totalKobo: rows.reduce((sum, row) => sum + row.amountKobo, 0),
    nairaPerUsd: rows[0]?.nairaPerUsd ?? null,
    rateAt: rows[0]?.rateAt ?? null,
    withdrawalIds: rows.map((row) => row.id),
    actorId,
  });
  return created.ok ? { id: created.id } : null;
}

function addBatch(batchIds: string[], rows: WithdrawalSnapshot[], id: string, addCount: (value: number) => void, addKobo: (value: number) => void): void {
  batchIds.push(id);
  addCount(rows.length);
  addKobo(rows.reduce((sum, row) => sum + row.amountKobo, 0));
}
