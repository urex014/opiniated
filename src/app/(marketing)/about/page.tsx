import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[28px] font-medium">About Opiniated</h1>
      <div className="mt-6 grid gap-4 text-sm leading-6">
        <p>Opiniated is a survey rewards site. You create an account, take surveys supplied by BitLabs, and keep a record of rewards that the provider confirms.</p>
        <p>The site shows the reward and estimated length when BitLabs sends them. It does not invent conversion rates, extra descriptions, or activity from other people.</p>
        <p>Survey questions are asked by the research provider, not by Opiniated. Read each survey’s own notice before you share personal details.</p>
      </div>
    </article>
  );
}
