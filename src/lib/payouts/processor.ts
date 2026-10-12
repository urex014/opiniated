import type { PaystackClient } from "@/lib/paystack/client";
import type { PaystackKeyMode } from "@/lib/paystack/mode";
import { BATCH_GAP_MS, BATCH_LIMIT } from "@/lib/payouts/constants";
import { fundingCoversWithFees } from "@/lib/payouts/money";
import { isTransferReference } from "@/lib/payouts/reference";
import type { PayoutRepository, WithdrawalSnapshot } from "@/lib/payouts/repository";

const REASON = "Opiniated withdrawal";

export type BatchSubmitResult =
  | { ok: true; code: "queued"; count: number; batchId: string }
  | {
      ok: false;
      code: "disabled" | "not_configured" | "live_not_confirmed" | "empty" | "insufficient_funds" | "interval" | "uncertain" | "rejected";
      message: string;
      batchId?: string;
    };

export type BatchDeps = {
  repo: PayoutRepository;
  client: PaystackClient;
  now: Date;
  transfersEnabled: boolean;
  liveConfirmed: boolean;
  keyMode: PaystackKeyMode;
  feeBufferKobo: number;
  actorId: string;
};

let chain: Promise<void> = Promise.resolve();

/** One batch at a time in this process. The database gate also blocks another process for five seconds. */
export function submitApprovedBatch(deps: BatchDeps): Promise<BatchSubmitResult> {
  const run = chain.then(() => submitOnce(deps));
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function submitPendingBatch(deps: BatchDeps): Promise<BatchSubmitResult> {
  const run = chain.then(() => submitPendingOnce(deps));
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function submitOnce(deps: BatchDeps): Promise<BatchSubmitResult> {
  const blocked = configBlock(deps);
  if (blocked) return blocked;
  const approved = await deps.repo.listApproved(BATCH_LIMIT);
  const eligible = approved.filter(canSend);
  if (eligible.length === 0) return { ok: false, code: "empty", message: "There are no approved withdrawals to send." };
  return sendClaimed(deps, eligible, null);
}

async function submitPendingOnce(deps: BatchDeps): Promise<BatchSubmitResult> {
  const blocked = configBlock(deps);
  if (blocked) return blocked;
  const pending = await deps.repo.oldestPendingBatch();
  if (!pending) return { ok: false, code: "empty", message: "There is no pending payout batch." };
  const rows: WithdrawalSnapshot[] = [];
  for (const id of pending.withdrawalIds) {
    const row = await deps.repo.getById(id);
    if (row && row.status === "APPROVED") rows.push(row);
  }
  const eligible = rows.filter(canSend).slice(0, BATCH_LIMIT);
  if (eligible.length === 0) return { ok: false, code: "empty", message: "The pending batch has no transfers ready to send." };
  return sendClaimed(deps, eligible, pending.id);
}

function configBlock(deps: BatchDeps): BatchSubmitResult | null {
  if (!deps.transfersEnabled) return { ok: false, code: "disabled", message: "Live bulk transfers are turned off." };
  if (deps.keyMode === "missing" || deps.keyMode === "unknown") {
    return { ok: false, code: "not_configured", message: "Paystack is not configured for transfers." };
  }
  if (deps.keyMode === "live" && !deps.liveConfirmed) {
    return {
      ok: false,
      code: "live_not_confirmed",
      message: "Live transfers stay off until the business confirms Paystack bulk-transfer settings, including OTP.",
    };
  }
  return null;
}

async function sendClaimed(deps: BatchDeps, eligible: WithdrawalSnapshot[], existingBatchId: string | null): Promise<BatchSubmitResult> {
  const balance = await deps.client.getBalance();
  if (!balance.ok) return { ok: false, code: "insufficient_funds", message: balance.message };
  const ngn = balance.balances.find((item) => item.currency === "NGN");
  if (!ngn || !fundingCoversWithFees(ngn.amount, eligible.map((row) => row.amountKobo), deps.feeBufferKobo)) {
    return { ok: false, code: "insufficient_funds", message: "The Paystack balance does not cover this batch and its estimated fees. Nothing was submitted." };
  }

  const gated = await deps.repo.tryAdvanceGate(deps.now, BATCH_GAP_MS);
  if (!gated) return { ok: false, code: "interval", message: "A batch was submitted less than five seconds ago." };

  const claimed = await deps.repo.claimApproved(eligible.map((row) => row.id), deps.now);
  if (claimed.length === 0) return { ok: false, code: "empty", message: "No approved withdrawals were still available to send." };

  const batchId = existingBatchId
    ? existingBatchId
    : (
        await deps.repo.createBatch({
          actorId: deps.actorId,
          transferCount: claimed.length,
          message: null,
          submittedAt: deps.now,
          withdrawalIds: claimed.map((row) => row.id),
        })
      ).id;
  if (existingBatchId) {
    await deps.repo.detachUnclaimed(existingBatchId, claimed.map((row) => row.id));
    await deps.repo.updateBatch(existingBatchId, { status: "PREPARING", message: null, submittedAt: deps.now });
  }

  const result = await deps.client.bulkTransfer(
    claimed.map((row) => ({ amount: row.amountKobo, reference: row.reference, reason: REASON, recipient: row.recipientCode })),
  );

  if (result.outcome === "uncertain") {
    await deps.repo.updateBatch(batchId, { status: "UNCERTAIN", message: result.message });
    return { ok: false, code: "uncertain", message: result.message, batchId };
  }
  if (result.outcome === "rejected") {
    await deps.repo.updateBatch(batchId, { status: "REJECTED", message: result.message });
    await reconcileRejected(deps, claimed);
    return { ok: false, code: "rejected", message: result.message, batchId };
  }
  for (const item of result.items) {
    if (item.transferCode) await deps.repo.setTransferCode(item.reference, item.transferCode);
  }
  await deps.repo.updateBatch(batchId, { status: "QUEUED", message: result.message });
  return { ok: true, code: "queued", count: claimed.length, batchId };
}

async function reconcileRejected(deps: BatchDeps, claimed: WithdrawalSnapshot[]): Promise<void> {
  for (const row of claimed) {
    const verified = await deps.client.verifyTransfer(row.reference);
    if (verified.outcome === "unavailable") continue;
    if (verified.outcome === "not_found") {
      await deps.repo.releaseUnsent({
        reference: row.reference,
        at: deps.now,
        reason: "Paystack rejected the batch before creating this transfer.",
      });
      continue;
    }
    if (verified.status === "pending" || verified.status === "other") continue;
    await deps.repo.settle({
      reference: row.reference,
      verified: verified.status,
      amountKobo: verified.amount,
      currency: verified.currency,
      transferCode: verified.transferCode,
      at: deps.now,
    });
  }
}

function canSend(row: WithdrawalSnapshot): boolean {
  return isTransferReference(row.reference) && row.recipientCode.startsWith("RCP_") && Number.isInteger(row.amountKobo) && row.amountKobo > 0 && row.currency === "NGN";
}
