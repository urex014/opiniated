import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[28px] font-medium">Privacy</h1>
      <div className="mt-6 grid gap-4 text-sm leading-6">
        <p>Opiniated stores the email address and optional name you provide, a hash of your password, and the reward and survey activity needed to keep your account accurate.</p>
        <p>Your internal account id is sent to BitLabs as the user id when surveys are requested, so the provider can return surveys and callbacks for that account.</p>
        <p>When surveys are loaded from the server, your IP address and user agent may be forwarded to BitLabs. Their documentation says server-side use of the survey API needs this, and the feature must be enabled on the BitLabs account.</p>
        <p>Survey questions themselves are collected by the research provider after you leave this site. Some surveys are tagged as possibly asking for personal information. That tag is shown when BitLabs sends it.</p>
        <p>Password reset emails are sent only when SMTP is configured. Reset tokens are stored as hashes and expire after one hour.</p>
        <p>This page is a product description of the data the application handles. It is not a complete legal privacy notice.</p>
      </div>
    </article>
  );
}
