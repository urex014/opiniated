"use client";

import { useState } from "react";
import { useActionState } from "react";
import { adminPayoutAction, type PayoutFormState } from "@/lib/payouts/actions";
import { FormNote } from "@/components/ui/field";

const initial: PayoutFormState = {};

export function CreateBatchForm() {
  const [state, action, pending] = useActionState(adminPayoutAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      <FormNote error={state.error} message={state.message} />
      <p className="text-sm leading-6 text-muted">
        Create a batch to reserve eligible balances for review. This does not send money.
      </p>
      <button type="submit" name="intent" value="create" disabled={pending} className="btn btn-secondary w-fit">
        {pending ? "Creating…" : "Create payout batch"}
      </button>
    </form>
  );
}

export function ReleaseBatchForm({ batchId, count, totalLabel, totalKobo }: { batchId: string; count: number; totalLabel: string; totalKobo: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(adminPayoutAction, initial);
  if (!open) {
    return (
      <button type="button" className="btn btn-primary mt-3" onClick={() => setOpen(true)}>
        Release Batch
      </button>
    );
  }
  return (
    <form action={action} className="mt-3 grid max-w-xl gap-3">
      <FormNote error={state.error} message={state.message} />
      <p className="text-sm leading-6">
        Release this batch to Paystack for {count} {count === 1 ? "recipient" : "recipients"}, total {totalLabel}? A queued
        transfer is not paid until Paystack confirms it.
      </p>
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="confirmCount" value={String(count)} />
      <input type="hidden" name="confirmKobo" value={String(totalKobo)} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="release-batch" disabled={pending} className="btn btn-primary">
          {pending ? "Releasing…" : "Release Batch"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AdminWithdrawalActions({ id, status, batchStatus }: { id: string; status: string; batchStatus: string | null }) {
  const [state, action, pending] = useActionState(adminPayoutAction, initial);
  const open = status === "PENDING" || status === "UNDER_REVIEW" || status === "APPROVED";
  return (
    <form action={action} className="mt-3 grid gap-2">
      <input type="hidden" name="withdrawalId" value={id} />
      <FormNote error={state.error} message={state.message} />
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" || status === "UNDER_REVIEW" ? (
          <button type="submit" name="intent" value="approve" disabled={pending} className="btn btn-secondary">
            Approve
          </button>
        ) : null}
        {open ? (
          <button type="submit" name="intent" value="reject" disabled={pending} className="btn btn-secondary">
            Reject
          </button>
        ) : null}
        {status === "PROCESSING" || status === "PAID" || status === "FAILED" || status === "REVERSED" ? (
          <button type="submit" name="intent" value="reconcile" disabled={pending} className="btn btn-secondary">
            Reconcile
          </button>
        ) : null}
        {status === "PROCESSING" && batchStatus === "REJECTED" ? (
          <button type="submit" name="intent" value="release" disabled={pending} className="btn btn-secondary">
            Restore reservation
          </button>
        ) : null}
        {status === "FAILED" ? (
          <button type="submit" name="intent" value="retry" disabled={pending} className="btn btn-secondary">
            Retry after reconcile
          </button>
        ) : null}
      </div>
    </form>
  );
}
