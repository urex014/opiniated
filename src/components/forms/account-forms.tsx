"use client";

import { useActionState } from "react";
import { changePasswordAction, deleteAccountAction, sendVerificationAction, updateProfileAction, type FormState } from "@/lib/auth/actions";
import { Field, FormNote } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

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
        className="btn btn-primary w-fit"
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
      <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" visibilityLabel="current password" error={state.fieldErrors?.currentPassword?.[0]} />
      <PasswordField label="New password" name="password" autoComplete="new-password" visibilityLabel="password" error={state.fieldErrors?.password?.[0]} />
      <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" visibilityLabel="confirm password" error={state.fieldErrors?.confirm?.[0]} />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-secondary w-fit"
      >
        Update password
      </button>
    </form>
  );
}

export function VerificationForm() {
  const [state, action, pending] = useActionState(sendVerificationAction, initial);
  return (
    <form action={action} className="grid max-w-md gap-3">
      <FormNote error={state.error} message={state.message} />
      <button type="submit" disabled={pending} className="btn btn-secondary w-fit">
        {pending ? "Sending…" : "Send verification email"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, initial);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <FormNote error={state.error} />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        visibilityLabel="password"
        error={state.fieldErrors?.password?.[0]}
      />
      <button type="submit" disabled={pending} className="btn btn-secondary w-fit">
        {pending ? "Deleting…" : "Delete account"}
      </button>
    </form>
  );
}
