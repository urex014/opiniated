import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your opinions are worth something",
};

const steps = [
  { title: "Create your account", text: "Register with an email and password. Your account is how rewards are matched to you." },
  { title: "Browse available surveys", text: "See the surveys you currently qualify for, with the reward and estimated time when the provider sends them." },
  { title: "Complete surveys you qualify for", text: "Open a survey and answer it on the provider’s site. Some surveys end early if you do not match." },
  { title: "Receive rewards for verified completions", text: "A reward is added only after BitLabs confirms the completion. Opening a survey is not enough." },
];

const faqs = [
  {
    q: "Are surveys always available?",
    a: "No. The list changes through the day, and eligibility depends on your profile and location. An empty list is normal.",
  },
  {
    q: "When is a reward added?",
    a: "After BitLabs sends a verified completion callback. Screen-outs are recorded, but they do not add a reward.",
  },
  {
    q: "Can I withdraw the balance?",
    a: "This version tracks rewards that have been credited. It does not pay them out. A balance is not a cash transfer.",
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
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <h1 className="max-w-xl text-[32px] font-medium leading-tight text-ink">Your opinions are worth something.</h1>
            <p className="mt-3 max-w-xl text-base text-muted">
              Share your views through online surveys and earn rewards for the time you spend participating.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover">
                Start earning
              </Link>
              <Link href="/how-it-works" className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm font-medium">
                See how it works
              </Link>
            </div>
            <p className="mt-4 max-w-xl text-sm text-muted">
              Surveys are not guaranteed to be available, and not every attempt qualifies for a reward.
            </p>
          </div>
          <ExampleList />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-xl font-medium">How it works</h2>
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {steps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3 py-4">
              <span className="text-sm font-medium text-brand">{index + 1}</span>
              <div>
                <h3 className="text-base font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-medium">How rewards work</h2>
            <p className="mt-3 text-sm text-muted">
              Each survey shows the reward amount BitLabs provides for your account. Amounts use the currency configured
              for this site. They are stored as whole units so balances do not drift.
            </p>
            <p className="mt-3 text-sm text-muted">
              Completions and reversals come from signed server callbacks. You cannot add a reward from the browser.
              Redemption is not part of this site yet, so a credited balance is a record of earnings, not a payout.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-medium">Availability varies</h2>
            <p className="mt-3 text-sm text-muted">
              The survey list is personal. Two people can see different surveys, and a survey can disappear after it
              fills or after you no longer match. If none are available, check back later.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-xl font-medium">Questions</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {faqs.map((item) => (
            <details key={item.q} className="py-3">
              <summary className="cursor-pointer text-sm font-medium">{item.q}</summary>
              <p className="mt-2 text-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <div>
            <h2 className="text-xl font-medium">Create an account to see your surveys</h2>
            <p className="mt-1 text-sm text-muted">You will only see surveys matched to your account.</p>
          </div>
          <Link href="/register" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover">
            Sign up
          </Link>
        </div>
      </section>
    </>
  );
}

function ExampleList() {
  const rows = [
    ["Shopping habits", "8 minutes", "0.75 PTS"],
    ["Weekly media diary", "12 minutes", "1.10 PTS"],
  ];
  return (
    <aside className="border border-line bg-white" aria-label="Example of the survey list">
      <p className="border-b border-line px-4 py-2 text-xs text-muted">Example of the survey list. These are not live offers.</p>
      <ul>
        {rows.map(([title, time, amount]) => (
          <li key={title} className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted">Estimated time: {time}</p>
            </div>
            <p className="text-sm font-medium">{amount}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
