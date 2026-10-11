import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[28px] font-medium">Terms</h1>
      <div className="mt-6 grid gap-4 text-sm leading-6">
        <p>These terms describe how this Opiniated installation works. An operator should have them reviewed before a public launch.</p>
        <p>You need an account to view surveys and rewards. You are responsible for keeping your password private.</p>
        <p>Surveys are offered by BitLabs and its research partners. Availability, eligibility, length, and reward amounts come from that provider and can change without notice.</p>
        <p>A reward is credited only after a verified provider callback. Screen-outs, duplicate callbacks, and rejected callbacks do not increase your balance. Reversals can reduce it.</p>
        <p>Balances on this site are an internal ledger in the configured reward unit. They are not a promise of cash, a bank balance, or a completed payout. This version does not offer withdrawals.</p>
        <p>Do not misuse the service, attempt to credit your own balance, or interfere with callback processing.</p>
      </div>
    </article>
  );
}
