import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[28px] font-medium">Help</h1>
      <div className="mt-6 grid gap-4 text-sm leading-6">
        <p>If the survey list is empty, there may be nothing you qualify for at the moment. Use Refresh surveys later.</p>
        <p>If surveys fail to load, use Retry. A VPN, an unsupported country, or a provider restriction can also block the list. The page shows that reason when BitLabs sends one.</p>
        <p>A survey that will not start has usually left the list. Go back to Surveys and pick a current one.</p>
        <p>
          Reward questions belong on the <Link href="/rewards">rewards</Link> page after you sign in. Only verified callbacks change the balance.
        </p>
      </div>
    </article>
  );
}
