"use client";

import { useActionState } from "react";
import { adminPayoutAction, type PayoutFormState } from "@/lib/payouts/actions";
import { FormNote } from "@/components/ui/field";

const initial: PayoutFormState = {};

export function AdminBatchForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(adminPayoutAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      <FormNote error={state.error} message={state.message} />
      <p className="text-sm leading-6 text-muted">
        {enabled
          ? "Submitting sends one saved batch, at most 100 transfers. A queued transfer is not paid until Paystack confirms it."
          : "Live bulk transfers are turned off, or new submissions are paused. Saving a batch does not send money."}
      </p>
      <button type="submit" name="intent" value="submit" disabled={pending} className="btn btn-primary w-fit">
        {pending ? "Submitting…" : "Submit approved batch"}
      </button>
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
            Release unsent
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
