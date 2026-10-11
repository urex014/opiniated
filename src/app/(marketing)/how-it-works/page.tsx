import type { Metadata } from "next";
import Link from "next/link";
import { StepList } from "@/components/marketing/step-list";

export const metadata: Metadata = { title: "How it works" };

const steps = [
  { title: "Surveys come in", text: "Opiniated lists surveys for the signed-in account. Our providers decides which surveys you can take." },
  { title: "You answer them on the provider’s site", text: "Choose a survey and you are sent to the provider-hosted survey. Opiniated does not host the questionnaire." },
  { title: "A signed callback credits the reward", text: "When our providers confirms a completion, it calls this site with a signed request. That request is checked, stored once, and applied to your balance. A second copy of the same callback does not add the reward again." },
  { title: "Reversals stay in the history", text: "If a completion is later reversed, the balance is reduced and the original transaction stays in the history." },
  { title: "This page is a ledger", text: "There is no withdrawal flow in this version. The rewards page is a ledger, not a bank transfer." },
];

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-medium text-brand">Survey rewards</p>
      <h1 className="page-title mt-2">How it works</h1>
      <div className="mt-6">
        <StepList steps={steps} />
      </div>
      <Link href="/register" className="btn btn-primary btn-lg mt-8">
        Create an account
      </Link>
    </article>
  );
}
