import type { Metadata } from "next";
import { readEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  const email = readEnv().supportEmail;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[28px] font-medium">Contact</h1>
      {email ? (
        <p className="mt-4 text-sm">
          Email <a className="text-brand" href={`mailto:${email}`}>{email}</a> for account help.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          The site operator has not published a support email yet. Set NEXT_PUBLIC_SUPPORT_EMAIL to show one here.
        </p>
      )}
    </article>
  );
}
