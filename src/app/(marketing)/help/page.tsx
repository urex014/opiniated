import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="page-title">Help</h1>
      <div className="mt-6 grid gap-4 text-sm leading-6">
        <p>If the survey list is empty, there may be nothing you qualify for at the moment. Use Refresh surveys later.</p>
        <p>If surveys fail to load, use Retry. A VPN, an unsupported country, or a provider restriction can also block the list. The page shows that reason when BitLabs sends one.</p>
        <p>A survey that will not start has usually left the list. Go back to Surveys and pick a current one.</p>
        <p>
          You need an account before a survey can be started. Reward questions belong on the rewards page after you
          sign in. Only a verified provider callback changes the balance. Opiniated Points are the in-app record of
          those credits. They are not cashed out in this version.
        </p>
        <p>
          Privacy requests and the support address are on the <Link href="/contact" className="text-brand">contact page</Link>.
        </p>
      </div>
    </article>
  );
}
