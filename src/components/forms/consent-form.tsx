"use client";

import Link from "next/link";
import { useActionState } from "react";
import { renewConsentAction, type FormState } from "@/lib/auth/actions";
import { FormNote } from "@/components/ui/field";
import { POLICY_LABELS, POLICY_VERSIONS, type PolicyDocument } from "@/lib/legal/versions";

const initial: FormState = {};

export function RenewConsentForm({ documents, nextPath }: { documents: PolicyDocument[]; nextPath: string }) {
  const [state, action, pending] = useActionState(renewConsentAction, initial);
  return (
    <form action={action} className="grid gap-4">
      <FormNote error={state.error} message={state.message} />
      <input type="hidden" name="next" value={nextPath} />
      {documents.map((document) => {
        const name = document === "privacy" ? "acceptPrivacy" : "acceptTerms";
        const href = document === "privacy" ? "/privacy" : "/terms";
        const error = state.fieldErrors?.[name]?.[0];
        return (
          <div key={document} className="grid gap-1">
            <div className="flex items-start gap-3">
              <input
                id={name}
                name={name}
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#247A57]"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${name}-error` : undefined}
              />
              <label htmlFor={name} className="text-sm leading-5">
                I have read and agree to the{" "}
                <Link href={href} className="text-brand" target="_blank" rel="noopener noreferrer">
                  {POLICY_LABELS[document]}
                </Link>{" "}
                (version {POLICY_VERSIONS[document]}).
              </label>
            </div>
            {error ? (
              <p id={`${name}-error`} className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <button type="submit" disabled={pending} className="btn btn-primary w-fit">
        {pending ? "Saving…" : "Save acceptance"}
      </button>
    </form>
  );
}
