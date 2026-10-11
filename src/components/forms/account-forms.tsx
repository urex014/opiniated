"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction, type FormState } from "@/lib/auth/actions";
import { Field, FormNote } from "@/components/ui/field";

const initial: FormState = {};

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <FormNote error={state.error} message={state.message} />
      <Field label="Name" name="name" autoComplete="name" defaultValue={name} error={state.fieldErrors?.name?.[0]} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-fit items-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
      >
        Save name
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <FormNote error={state.error} message={state.message} />
      <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" error={state.fieldErrors?.currentPassword?.[0]} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password?.[0]} />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm?.[0]} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-fit items-center rounded-md border border-line px-3 text-sm font-medium disabled:opacity-60"
      >
        Update password
      </button>
    </form>
  );
}
