"use client";

import { useActionState } from "react";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type FormState,
} from "@/lib/auth/actions";
import { Field, FormNote } from "@/components/ui/field";

const initial: FormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormNote error={state.error} />
      <Field label="Name" name="name" autoComplete="name" error={state.fieldErrors?.name?.[0]} />
      <Field label="Email" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email?.[0]} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password?.[0]}
      />
      <p className="text-xs text-muted">At least 8 characters, with a letter, a number, and a symbol.</p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormNote error={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email?.[0]} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password?.[0]}
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormNote error={state.error} message={state.message} />
      <Field label="Email" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email?.[0]} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormNote error={state.error} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password?.[0]} />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm?.[0]} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
