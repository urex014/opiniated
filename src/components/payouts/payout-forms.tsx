"use client";

import { useActionState } from "react";
import { bankAccountAction, type PayoutFormState } from "@/lib/payouts/actions";
import { Field, FormNote } from "@/components/ui/field";

const initial: PayoutFormState = {};

export function BankForm({
  banks,
  saved,
}: {
  banks: { code: string; name: string }[];
  saved: { bankName: string; accountLast4: string; accountName: string } | null;
}) {
  const [state, action, pending] = useActionState(bankAccountAction, initial);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <FormNote error={state.error} message={state.message} />
      {saved ? (
        <p className="text-sm leading-6 text-muted">
          Saved account: {saved.bankName} ending {saved.accountLast4}, {saved.accountName}. Check a new account and save it to replace this one.
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted">No bank account saved yet.</p>
      )}
      <div className="grid gap-1">
        <label htmlFor="bankCode" className="text-[13px] font-medium text-ink">
          Bank
        </label>
        <select id="bankCode" name="bankCode" className="field-input" required defaultValue="">
          <option value="" disabled>
            Select a bank
          </option>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
      </div>
      <Field label="Account number" name="accountNumber" autoComplete="off" />
      {state.accountName ? (
        <>
          <p className="text-sm leading-6 text-ink">Account name: {state.accountName}</p>
          <input type="hidden" name="confirmedName" value={state.accountName} />
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="check" disabled={pending} className="btn btn-secondary">
          {pending ? "Checking…" : "Check account"}
        </button>
        {state.accountName ? (
          <button type="submit" name="intent" value="save" disabled={pending} className="btn btn-primary">
            Save this account
          </button>
        ) : null}
      </div>
    </form>
  );
}
