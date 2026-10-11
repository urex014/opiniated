"use client";

import { useActionState } from "react";
import { verifyEmailAction, type FormState } from "@/lib/auth/actions";
import { FormNote } from "@/components/ui/field";

const initial: FormState = {};

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, initial);
  return (
    <form action={action} className="mt-4 grid max-w-sm gap-3">
      <FormNote error={state.error} message={state.message} />
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className="btn btn-primary w-fit">
        {pending ? "Verifying…" : "Verify email"}
      </button>
    </form>
  );
}
