"use client";

import { useActionState } from "react";
import { FormNote, Field } from "@/components/ui/field";
import { adminScheduleAction } from "@/lib/payouts/schedule-actions";
import type { PayoutFormState } from "@/lib/payouts/actions";

const initial: PayoutFormState = {};

export function AdminScheduleForm({
  paused,
  intervalDays,
  minUsdCents,
  rateLabel,
}: {
  paused: boolean;
  intervalDays: number;
  minUsdCents: number;
  rateLabel: string;
}) {
  const [state, action, pending] = useActionState(adminScheduleAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      <FormNote error={state.error} message={state.message} />
      <p className="text-sm leading-6 text-muted">
        Release is {paused ? "paused" : "allowed"}. Minimum {minUsdCents} cents. {rateLabel} Creating a batch only reserves balances. The interval does not send transfers.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value={paused ? "resume" : "pause"} disabled={pending} className="btn btn-secondary">
          {paused ? "Allow release" : "Pause release"}
        </button>
      </div>
      <Field label="Interval in days" name="intervalDays" type="number" defaultValue={String(intervalDays)} />
      <Field label="Minimum payout in US cents" name="minUsdCents" type="number" defaultValue={String(minUsdCents)} />
      <button type="submit" name="intent" value="settings" disabled={pending} className="btn btn-secondary w-fit">
        Save schedule
      </button>
      <Field label="Naira per dollar" name="nairaPerUsd" type="number" />
      <Field label="Rate expires after days" name="validForDays" type="number" defaultValue="7" />
      <Field label="Note" name="note" />
      <button type="submit" name="intent" value="fx" disabled={pending} className="btn btn-secondary w-fit">
        Save currency rate
      </button>
    </form>
  );
}
