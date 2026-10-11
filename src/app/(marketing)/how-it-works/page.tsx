import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[28px] font-medium">How it works</h1>
      <div className="mt-6 grid gap-5 text-sm leading-6 text-ink">
        <p>Opiniated lists surveys from BitLabs for the signed-in account. The provider decides which surveys you can take.</p>
        <p>Choose a survey and you are sent to the provider-hosted survey. Opiniated does not host the questionnaire.</p>
        <p>
          When BitLabs confirms a completion, it calls this site with a signed request. That request is checked, stored
          once, and applied to your balance. A second copy of the same callback does not add the reward again.
        </p>
        <p>If a completion is later reversed, the balance is reduced and the original transaction stays in the history.</p>
        <p>There is no withdrawal flow in this version. The rewards page is a ledger, not a bank transfer.</p>
      </div>
      <Link href="/register" className="mt-8 inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover">
        Create an account
      </Link>
    </article>
  );
}
