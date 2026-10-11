import type { ReactNode } from "react";

export function LegalDraftNotice() {
  return (
    <p className="mt-4 rounded-md border border-line bg-surface px-3 py-3 text-sm leading-6">
      Draft for operator review. This page describes how this Opiniated installation works today. It is not a legal
      opinion, and publishing it does not make the operator GDPR- or CCPA-compliant. Items marked “Needs review” still
      need a decision from the operator or counsel.
    </p>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-medium text-ink">{title}</h2>
      <div className="grid gap-3 text-sm leading-6">{children}</div>
    </section>
  );
}
