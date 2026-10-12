import type { PaystackClient } from "@/lib/paystack/client";
import { submitApprovedBatch, submitPendingBatch, type BatchSubmitResult } from "@/lib/payouts/processor";
import type { PayoutRepository } from "@/lib/payouts/repository";
import type { PaystackKeyMode } from "@/lib/paystack/mode";

export type AdminResult = { error?: string; message?: string };

export async function approveWithdrawal(repo: PayoutRepository, id: string, actorId: string, at: Date): Promise<AdminResult> {
  const result = await repo.review({ id, actorId, decision: "approve", reason: null, at });
  if (!result.ok) return { error: result.code === "not_allowed" ? "This request can no longer be approved." : "The withdrawal was not found." };
  return { message: "Withdrawal approved. It is still reserved and has not been paid." };
}

export async function rejectWithdrawal(repo: PayoutRepository, id: string, actorId: string, reason: string, at: Date): Promise<AdminResult> {
  const result = await repo.review({ id, actorId, decision: "reject", reason: reason.trim() || "Rejected before the transfer was sent.", at });
  if (!result.ok) return { error: result.code === "not_allowed" ? "This request can no longer be rejected." : "The withdrawal was not found." };
  return { message: "Withdrawal rejected and the reserved points were released." };
}

export async function submitBatch(input: {
  repo: PayoutRepository;
  client: PaystackClient;
  actorId: string;
  now: Date;
  transfersEnabled: boolean;
  liveConfirmed: boolean;
  keyMode: PaystackKeyMode;
  feeBufferKobo: number;
}): Promise<BatchSubmitResult> {
  const deps = {
    repo: input.repo,
    client: input.client,
    now: input.now,
    transfersEnabled: input.transfersEnabled,
    liveConfirmed: input.liveConfirmed,
    keyMode: input.keyMode,
    feeBufferKobo: input.feeBufferKobo,
    actorId: input.actorId,
  };
  const pending = await submitPendingBatch(deps);
  const result = pending.code === "empty" ? await submitApprovedBatch(deps) : pending;
  await input.repo.recordAudit({
    actorId: input.actorId,
    action: "batch.reconcile",
    batchId: "batchId" in result ? result.batchId : undefined,
    detail: result.ok ? `Queued ${result.count}` : result.message,
  });
  return result;
}

export async function reconcileWithdrawal(repo: PayoutRepository, client: PaystackClient, id: string, actorId: string, at: Date): Promise<AdminResult> {
  const withdrawal = await repo.getById(id);
  if (!withdrawal) return { error: "The withdrawal was not found." };
  const verified = await client.verifyTransfer(withdrawal.reference);
  await repo.recordAudit({
    actorId,
    action: "withdrawal.reconcile",
    withdrawalId: id,
    detail: verified.outcome === "found" ? verified.status : verified.outcome,
  });
  if (verified.outcome === "unavailable") return { error: verified.message };
  if (verified.outcome === "not_found") {
    return { message: "Paystack has no transfer for the current reference. Leave it in place unless the batch was rejected." };
  }
  if (verified.status === "pending" || verified.status === "other") {
    return { message: "Paystack has not finished this transfer. It was not marked paid." };
  }
  const settled = await repo.settle({
    reference: withdrawal.reference,
    verified: verified.status,
    amountKobo: verified.amount,
    currency: verified.currency,
    transferCode: verified.transferCode,
    at,
  });
  if (settled === "paid") return { message: "Paystack confirmed the transfer. The withdrawal is paid." };
  if (settled === "failed") return { message: "Paystack reported a failure. The reserved points were released." };
  if (settled === "reversed") return { message: "Paystack reported a reversal. The balance was reconciled once." };
  if (settled === "anomaly") return { message: "The provider status does not match this withdrawal. It was flagged and the balance was left unchanged." };
  return { message: "The withdrawal already matches Paystack." };
}

export async function releaseRejectedTransfer(repo: PayoutRepository, client: PaystackClient, id: string, actorId: string, at: Date): Promise<AdminResult> {
  const withdrawal = await repo.getById(id);
  if (!withdrawal) return { error: "The withdrawal was not found." };
  if (withdrawal.status !== "PROCESSING" || withdrawal.batchStatus !== "REJECTED") {
    return { error: "Only a processing withdrawal from a rejected batch can be released this way." };
  }
  const verified = await client.verifyTransfer(withdrawal.reference);
  if (verified.outcome === "unavailable") return { error: verified.message };
  if (verified.outcome !== "not_found") {
    return { error: "Paystack still has a record of this transfer, so it was not released." };
  }
  const released = await repo.releaseUnsent({
    reference: withdrawal.reference,
    at,
    reason: "Paystack has no transfer for this reference after rejecting the batch.",
  });
  await repo.recordAudit({ actorId, action: "withdrawal.released", withdrawalId: id, detail: withdrawal.reference });
  if (released !== "failed") return { error: "The reserved points were not released." };
  return { message: "Paystack has no transfer for this reference. The reserved points were released." };
}

export async function retryWithdrawal(
  repo: PayoutRepository,
  client: PaystackClient,
  input: { id: string; actorId: string; reference: string; minimumKobo: number; currencyCode: string; at: Date },
): Promise<AdminResult> {
  const withdrawal = await repo.getById(input.id);
  if (!withdrawal) return { error: "The withdrawal was not found." };
  if (withdrawal.status !== "FAILED") return { error: "Retry is available only after the previous attempt has failed and the points were released." };
  const verified = await client.verifyTransfer(withdrawal.reference);
  if (verified.outcome === "unavailable") return { error: verified.message };
  if (verified.outcome === "found" && (verified.status === "pending" || verified.status === "other")) {
    return { error: "Paystack has not finished the previous attempt. It was not retried." };
  }
  if (verified.outcome === "found" && (verified.status === "success" || verified.status === "reversed")) {
    await repo.settle({
      reference: withdrawal.reference,
      verified: verified.status,
      amountKobo: verified.amount,
      currency: verified.currency,
      transferCode: verified.transferCode,
      at: input.at,
    });
    return { error: "Paystack does not report that attempt as failed. It was flagged if the records disagree, and it was not retried." };
  }
  const failed = verified.outcome === "found" && verified.status === "failed";
  const missingAfterRejection = verified.outcome === "not_found" && withdrawal.batchStatus === "REJECTED";
  if (!failed && !missingAfterRejection) {
    return { error: "The previous attempt has not been confirmed as failed. It was not retried." };
  }
  const retried = await repo.beginRetry({
    withdrawalId: withdrawal.id,
    actorId: input.actorId,
    reference: input.reference,
    minimumKobo: input.minimumKobo,
    currencyCode: input.currencyCode,
    at: input.at,
  });
  if (!retried.ok) {
    if (retried.code === "insufficient" || retried.code === "open_withdrawal") {
      return { error: "The points are no longer available to reserve for another attempt." };
    }
    return { error: "The withdrawal could not be queued again." };
  }
  return { message: "The failed attempt was reconciled. A new approved attempt is reserved and has not been sent." };
}
