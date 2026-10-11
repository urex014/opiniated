import type { Metadata } from "next";
import Link from "next/link";
import { SupportContact } from "@/components/legal/support-contact";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <article className="mx-auto grid max-w-3xl gap-4 px-4 py-10 text-sm leading-6">
      <h1 className="page-title">Contact</h1>
      <SupportContact lead="For account help, reward questions, and privacy requests, email" />
      <p>
        Privacy requests are also described in the <Link href="/privacy" className="text-brand">Privacy Policy</Link>.
        The same address is used on the <Link href="/terms" className="text-brand">Terms of Service</Link> and in the
        footer. Signed-in account tools are on the account page after you log in.
      </p>
    </article>
  );
}
