import Link from "next/link";
import { StepList } from "@/components/marketing/step-list";
import { publicMetadata } from "@/lib/site/metadata";

export const metadata = publicMetadata("/how-it-works");

const steps = [
  { title: "Surveys come in", text: "Opiniated lists surveys for the signed-in account. The provider decides which surveys you can take." },
  { title: "You answer them on the provider’s site", text: "Choose a survey and you are sent to the provider-hosted survey. Opiniated does not host the questionnaire." },
  { title: "A signed callback credits the reward", text: "When the provider confirms a completion, it calls this site with a signed request. That request is checked, stored once, and applied to your balance. A second copy of the same callback does not add the reward again." },
  { title: "Reversals stay in the history", text: "If a completion is later reversed, the balance is reduced and the original transaction stays in the history." },
  { title: "Payouts run in scheduled batches", text: "100 OPN equal $1.00. Once the available balance reaches $5.00 and a verified Nigerian bank account has been saved for at least 24 hours, the next batch reserves it. You do not submit a withdrawal request. Reservation is not a payment. Paystack marks it paid only after the transfer succeeds." },
];

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-medium text-brand">Survey rewards</p>
      <h1 className="page-title mt-2">How it works</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        Opiniated matches a signed-in account to surveys, records a reward only after the provider confirms a
        completion, and pays an eligible balance to a verified Nigerian bank account.
      </p>
      <h2 className="section-title mt-8">From a survey to a payout</h2>
      <div className="mt-2">
        <StepList steps={steps} />
      </div>
      <h2 className="section-title mt-10">If you do not qualify</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        The provider can screen you out. That attempt can show in your activity, and the reward is not added. An empty
        survey list means nothing is available for the account right now. More detail is on the{" "}
        <Link href="/help" className="text-brand">help page</Link>.
      </p>
      <h2 className="section-title mt-10">Countries and payment</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Payouts are sent in naira through Paystack to a verified Nigerian bank account. The naira amount uses the
        whole-naira price per dollar stored on that payout. Other countries and payment methods are not offered.
        Processing depends on the Paystack balance and the bank. The full rules are in the{" "}
        <Link href="/terms" className="text-brand">Terms of Service</Link>.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/register" className="btn btn-primary btn-lg">
          Create an account
        </Link>
        <Link href="/contact" className="btn btn-secondary btn-lg">
          Contact support
        </Link>
      </div>
    </article>
  );
}
