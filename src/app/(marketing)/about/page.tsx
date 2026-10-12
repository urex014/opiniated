import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="page-title">About Opiniated</h1>
      <div className="mt-6 grid gap-4 text-sm leading-6">
        <p>
          Opiniated is a survey rewards site. You create an account, take surveys supplied by CPX Research when that
          provider is configured and enabled, and keep a record of rewards that the provider confirms. TheoremReach is not
          connected in this version.
        </p>
        <p>The site shows the reward and estimated length when the provider sends them. It does not invent conversion rates, extra descriptions, or activity from other people.</p>
        <p>Survey questions are asked by the research provider, not by Opiniated. Read each survey’s own notice before you share personal details.</p>
      </div>
    </article>
  );
}
