import Link from "next/link";
import { StepList } from "@/components/marketing/step-list";
import { publicMetadata } from "@/lib/site/metadata";

export const metadata = publicMetadata("/");

const steps = [
  { title: "Create your account", text: "Register with an email and password. Your account is how rewards are matched to you." },
  { title: "Browse available surveys", text: "See the surveys you currently qualify for, with the reward and estimated time when the provider sends them." },
  { title: "Complete surveys you qualify for", text: "Open a survey and answer it on the provider’s site. Some surveys end early if you do not match." },
  { title: "Receive rewards for verified completions", text: "A reward is added only after the survey provider confirms the completion. Opening a survey is not enough." },
];

const faqs = [
  {
    q: "Are surveys always available?",
    a: "No. The list changes through the day, and eligibility depends on your profile and location. An empty list is normal.",
  },
  {
    q: "When is a reward added?",
    a: "After a verified completion callback. Opening a survey, or returning to this site, does not add a reward.",
  },
  {
    q: "Can I withdraw the balance?",
    a: "100 OPN equal $1.00. Once your available balance reaches $5.00 and a verified Nigerian bank account has been saved for at least 24 hours, the next scheduled batch reserves it. You do not request a withdrawal. Paystack marks it paid only after the transfer succeeds.",
  },
  {
    q: "What if I do not qualify?",
    a: "The survey may screen you out. That attempt shows in your activity, and the reward is not added.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:py-14">
          <div>
            <p className="text-sm font-medium text-brand">Survey rewards</p>
            <h1 className="page-title page-title-display mt-2 max-w-xl text-ink">Your opinions are worth something.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">
              Share your views through online surveys and earn rewards for the time you spend participating.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary btn-lg">
                Start earning
              </Link>
              <Link href="/how-it-works" className="btn btn-secondary btn-lg">
                See how it works
              </Link>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
              Surveys are not guaranteed to be available, and not every attempt qualifies for a reward.
            </p>
          </div>
          <ExampleList />
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="section-title">How it works</h2>
          <div className="mt-2">
            <StepList steps={steps} />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-brand-wash">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
          <div>
            <h2 className="section-title">How rewards work</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Each survey shows the reward returned for your account. 100 OPN equal $1.00. Amounts are stored as
              whole OPN so balances do not drift.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Completions and reversals come from signed server callbacks. You cannot add a reward from the browser.
              Once the available balance reaches $5.00 and a verified Nigerian bank account has been saved for 24 hours,
              the next scheduled batch can reserve it. Paystack confirms the payment.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="section-title">Availability varies</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              The survey list is personal. Two people can see different surveys, and a survey can disappear after it
              fills or after you no longer match. If none are available, check back later.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="section-title">Before you start</h2>
        <ul className="mt-4 grid max-w-3xl list-disc gap-2 pl-5 text-sm leading-6 text-muted">
          <li>Rewards are Opiniated Points. 100 OPN equal $1.00.</li>
          <li>A reward is added only after the survey provider confirms the completion. Opening a survey is not enough.</li>
          <li>
            Payouts go to a verified Nigerian bank account through Paystack once the available balance reaches $5.00 and
            the account has been saved for at least 24 hours. Other payout countries are not offered.
          </li>
          <li>Surveys are not always available. A screen-out does not add a reward.</li>
        </ul>
        <nav aria-label="Related pages" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href="/how-it-works" className="font-medium text-brand">How it works</Link>
          <Link href="/help" className="font-medium text-brand">Help</Link>
          <Link href="/terms" className="font-medium text-brand">Terms</Link>
          <Link href="/privacy" className="font-medium text-brand">Privacy</Link>
          <Link href="/contact" className="font-medium text-brand">Contact</Link>
        </nav>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="section-title">Questions</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {faqs.map((item) => (
            <details key={item.q} className="py-3">
              <summary className="cursor-pointer text-sm font-medium transition-colors duration-150 hover:text-brand">
                {item.q}
              </summary>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <div>
            <h2 className="section-title">Create an account to see your surveys</h2>
            <p className="mt-1 text-sm text-muted">You will only see surveys matched to your account.</p>
          </div>
          <Link href="/register" className="btn btn-primary btn-lg">
            Sign up
          </Link>
        </div>
      </section>
    </>
  );
}

function ExampleList() {
  const rows = [
    ["Shopping habits", "8 minutes", "75 OPN ($0.75)"],
    ["Weekly media diary", "12 minutes", "110 OPN ($1.10)"],
  ];
  return (
    <aside className="survey-list bg-white" aria-label="Example of the survey list">
      <p className="border-b border-line bg-surface px-4 py-2 text-xs leading-5 text-muted">
        Example of the survey list. These are not live offers.
      </p>
      <ul>
        {rows.map(([title, time, amount]) => (
          <li key={title} className="survey-row sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-base font-medium text-ink">{title}</p>
              <p className="mt-1 text-sm text-muted">Estimated time: {time}</p>
            </div>
            <p className="reward-amount">{amount}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
