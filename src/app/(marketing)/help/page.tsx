import Link from "next/link";
import { publicMetadata } from "@/lib/site/metadata";

export const metadata = publicMetadata("/help");

const topics = [
  {
    title: "Why is the survey list empty?",
    body: "There may be nothing you qualify for at the moment. The list is personal and changes through the day. Use Refresh surveys later. If the list fails to load, use Retry. An empty list is not an error by itself.",
  },
  {
    title: "What happens if I do not qualify?",
    body: "The provider can screen you out or end the survey early. That attempt can show in your activity. A screen-out does not add a reward. A survey that will not start has usually left the list, so go back and pick a current one.",
  },
  {
    title: "When is a reward added?",
    body: "Only after a verified provider callback for your account. Opening a survey, returning to this site, or saying you finished does not change the balance. A later reversal reduces the available balance, and the original credit stays in the history.",
  },
  {
    title: "How do points convert, and when is a payout sent?",
    body: "The balance is Opiniated Points. 100 OPN equal $1.00. Once the available balance reaches $5.00 and a verified Nigerian bank account has been saved for at least 24 hours, the next scheduled batch reserves it. You do not request a withdrawal. Reservation is not a payment. Paystack marks it paid only after the transfer succeeds. Points below the minimum stay in the account.",
  },
  {
    title: "How do I confirm my email?",
    body: "When email delivery is turned on, the account page can send a confirmation message. Confirming the address records that the inbox is yours. Survey access is not blocked on that check.",
  },
  {
    title: "How do I protect my account?",
    body: "Use one account, keep the password private, and do not share it. The terms prohibit extra accounts, bots, and attempts to credit your own balance. There is no separate suspension switch in this version. Closing an account uses deletion, and the anonymized ledger stays so a payment can still be reconciled.",
  },
  {
    title: "How do I dispute a balance?",
    body: "Email support with the account email and the transaction time shown in your history. The operator compares that row with the provider callback. A provider’s decision that a completion did not qualify is the provider’s decision. This site cannot pay a reward the provider did not confirm.",
  },
];

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="page-title">Help</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        These answers match the current reward and payout rules. The binding text is the{" "}
        <Link href="/terms" className="text-brand">Terms of Service</Link>.
      </p>
      <div className="mt-8 grid gap-8">
        {topics.map((topic) => (
          <section key={topic.title}>
            <h2 className="text-base font-medium text-ink">{topic.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{topic.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm leading-6 text-muted">
        The payout steps are also on <Link href="/how-it-works" className="text-brand">How it works</Link>. Privacy
        requests and the support address are on the <Link href="/contact" className="text-brand">contact page</Link>.
      </p>
    </article>
  );
}
