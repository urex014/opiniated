"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type FormState,
} from "@/lib/auth/actions";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Field, FormNote } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { confirmPasswordMessage, registerFormValues, registerSchema } from "@/lib/validation/auth";

const initial: FormState = {};

export function RegisterForm({ siteKey, nextPath = "" }: { siteKey: string | null; nextPath?: string }) {
  const [state, action, pending] = useActionState(registerAction, initial);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [clientErrors, setClientErrors] = useState<FormState["fieldErrors"]>();
  const turnstileResetKey = useTurnstileReset(pending);

  const liveConfirmError = confirmPasswordMessage({
    password,
    confirm,
    passwordTouched,
    confirmTouched,
    submitted: attempted,
  });
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const confirmError = passwordsMatch
    ? undefined
    : liveConfirmError ?? clientErrors?.confirm?.[0] ?? state.fieldErrors?.confirm?.[0];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const passwordValue = String(formData.get("password") ?? "");
    const confirmValue = String(formData.get("confirm") ?? "");
    setPassword(passwordValue);
    setConfirm(confirmValue);
    setPasswordTouched(true);
    setConfirmTouched(true);
    setAttempted(true);

    const parsed = registerSchema.safeParse(registerFormValues(formData));
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setClientErrors(undefined);
  }

  return (
    <form action={action} className="grid gap-4" noValidate onSubmit={onSubmit}>
      <FormNote error={state.error} />
      <Field
        label="Full name"
        name="name"
        autoComplete="name"
        error={clientErrors?.name?.[0] ?? state.fieldErrors?.name?.[0]}
      />
      <p className="-mt-2 text-xs text-muted">Optional. It is shown on your account.</p>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={clientErrors?.email?.[0] ?? state.fieldErrors?.email?.[0]}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        visibilityLabel="password"
        hint="At least 8 characters, with a letter, a number, and a symbol."
        hintId="password-hint"
        error={clientErrors?.password?.[0] ?? state.fieldErrors?.password?.[0]}
        onChange={(value) => {
          setPassword(value);
          setPasswordTouched(true);
        }}
        onBlur={() => setPasswordTouched(true)}
      />
      <PasswordField
        label="Confirm password"
        name="confirm"
        autoComplete="new-password"
        visibilityLabel="confirm password"
        error={confirmError}
        onChange={setConfirm}
        onBlur={() => setConfirmTouched(true)}
      />
      <ConsentChoice
        name="acceptPrivacy"
        error={clientErrors?.acceptPrivacy?.[0] ?? state.fieldErrors?.acceptPrivacy?.[0]}
      >
        I have read and agree to the{" "}
        <Link href="/privacy" className="text-brand" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </Link>
        .
      </ConsentChoice>
      <ConsentChoice name="acceptTerms" error={clientErrors?.acceptTerms?.[0] ?? state.fieldErrors?.acceptTerms?.[0]}>
        I have read and agree to the{" "}
        <Link href="/terms" className="text-brand" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </Link>
        .
      </ConsentChoice>
      <TurnstileField siteKey={siteKey} action="signup" resetKey={turnstileResetKey} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function LoginForm({ siteKey, nextPath = "" }: { siteKey: string | null; nextPath?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const turnstileResetKey = useTurnstileReset(pending);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormNote error={state.error} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email?.[0]} />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        visibilityLabel="password"
        error={state.fieldErrors?.password?.[0]}
      />
      <TurnstileField siteKey={siteKey} action="login" resetKey={turnstileResetKey} />
      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}

function useTurnstileReset(pending: boolean): number {
  const [resetKey, setResetKey] = useState(0);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) setResetKey((value) => value + 1);
    wasPending.current = pending;
  }, [pending]);
  return resetKey;
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormNote error={state.error} message={state.message} />
      <Field label="Email" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email?.[0]} />
      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

function ConsentChoice({ name, error, children }: { name: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-3">
        <input
          id={name}
          name={name}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#247A57]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <label htmlFor={name} className="text-sm leading-5 text-ink">
          {children}
        </label>
      </div>
      {error ? (
        <p id={`${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormNote error={state.error} />
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        visibilityLabel="password"
        error={state.fieldErrors?.password?.[0]}
      />
      <PasswordField
        label="Confirm password"
        name="confirm"
        autoComplete="new-password"
        visibilityLabel="confirm password"
        error={state.fieldErrors?.confirm?.[0]}
      />
      <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
