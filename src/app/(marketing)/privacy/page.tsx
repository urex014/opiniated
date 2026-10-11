import type { Metadata } from "next";
import Link from "next/link";
import { LegalDraftNotice, LegalSection } from "@/components/legal/document";
import { SupportContact } from "@/components/legal/support-contact";
import { POLICY_VERSIONS } from "@/lib/legal/versions";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
      <header>
        <h1 className="page-title">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Version {POLICY_VERSIONS.privacy}</p>
        {/* <LegalDraftNotice /> */}
      </header>

      <LegalSection title="Who this notice covers">
        <p>
          This notice is for people who create an Opiniated account or contact the operator about one. Opiniated is the
          survey rewards site you are using. The operator of this installation is the controller of the account data
          described here. Survey companies that ask the questions after you leave this site are separate controllers of
          what you tell them.
        </p>
      </LegalSection>

      <LegalSection title="Information the application collects">
        <p>When you register, the application stores:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address.</li>
          <li>An optional name, if you provide one.</li>
          <li>A hash of your password. The password itself is not stored.</li>
          <li>
            A consent record for each policy you accept: the document, its version, whether the acceptance was at
            registration or a later renewal, the time, your IP address, and a shortened user agent.
          </li>
        </ul>
        <p>
          After you sign in, the application stores survey activity for your account, including the provider, survey
          reference, status, and times. It stores a reward ledger: the amount, status (including approved and reversed),
          provider transaction id, and related survey reference. It stores password-reset and email-verification tokens
          only as hashes, with an expiry time.
        </p>
        <p>
          The session cookie is named <code>opiniated_session</code>. It is HTTP-only, limited to this site, and kept
          for 14 days. In production it is sent only over HTTPS. The cookie holds an encrypted account id so the server
          can tell that you are signed in. The application does not set advertising or analytics cookies.
        </p>
        <p>
          Signup, sign-in, password reset, and email verification are rate limited in server memory. Those counters are
          not written to the database. Hosting and database providers may keep their own operational logs, including IP
          addresses. This application does not add a product analytics tool.
        </p>
      </LegalSection>

      <LegalSection title="How that information is used">
        <p>Account details are used to sign you in, keep the account unique, and send password-reset or email-verification messages when email delivery is configured.</p>
        <p>
          Those messages are sent through Resend when the operator has configured it. Resend receives the recipient
          address, the subject, and the message, which contains a one-time link. Opiniated stores the link only as a
          hash. The Resend API key stays on the server.
        </p>
        <p>Survey activity and the reward ledger are used to show your surveys, points, and transaction history, and to apply a provider reversal without crediting the same completion twice.</p>
        <p>Consent records are used to show which policy version you accepted and to ask again when a published version changes. A later acceptance is stored as its own row. It does not rewrite the registration acceptance.</p>
        <p>Security checks, including Cloudflare Turnstile on registration when it is configured, are used to reject automated signups. The Turnstile token is sent to Cloudflare for verification and is not stored.</p>
      </LegalSection>

      <LegalSection title="Survey providers">
        <p>
          Live surveys in this version come from BitLabs when the operator has configured it. To request surveys, the
          server sends BitLabs your internal account id, and may also send the IP address and user agent of the request.
          BitLabs uses that to decide which surveys to return and to send completion callbacks back to this account.
          The callback includes a transaction id, a survey reference, an event type, and a reward amount. Survey
          questions are asked on the provider’s site after you leave Opiniated.
        </p>
        <p>
          TheoremReach is not enabled. This installation does not call TheoremReach and does not send account data to
          TheoremReach. If the operator later enables it, the privacy notice will be updated and, where the change is
          material, you will be asked to accept the new version before participating. A future integration would share
          the account id and the participation data needed to start a survey and credit a verified completion, for that
          purpose only.
        </p>
      </LegalSection>

      <LegalSection title="What is not sold">
        <p>
          The application does not sell personal information and does not share it for cross-context advertising. It
          does share the account and request data described above with a configured survey provider so that provider
          can offer surveys and confirm completions.
        </p>
        <p>
          Needs review: counsel should decide whether any provider transfer has to be described as a “sale” or “share”
          under California law, and whether a separate opt-out control is required beyond closing the account.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>
          Account information is kept while the account is open. Password-reset links expire after one hour.
          Email-verification links expire after one day. From the account page you can correct your name, download a
          copy of the account data this application stores, or delete the account.
        </p>
        <p>
          Deletion removes your email, name, and password, signs you out, and deletes reset and verification tokens.
          The reward ledger, survey activity, and consent rows stay attached to an anonymized id so a later reversal or
          fraud check can still be applied. The email address is not kept on those rows.
        </p>
        <p>
          Needs review: the operator still needs a written retention schedule for provider callbacks, hosting logs, and
          the anonymized ledger, including how long each is kept and the legal basis for keeping it.
        </p>
      </LegalSection>

      <LegalSection title="Rights that may apply">
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or export personal information,
          to limit or object to certain uses, to withdraw consent for a policy you accepted, and to appeal a denial.
          California residents may also have the right to know, delete, and correct personal information, to opt out of
          a sale or share, and not to be discriminated against for exercising those rights. People in the EEA or UK may
          also have the right to lodge a complaint with a supervisory authority.
        </p>
        <p>
          You can access and correct the account data, download a copy, or delete the account while signed in. For any
          other request, use the contact below. The operator may need to confirm that the request comes from the
          account holder. These pages and controls do not, by themselves, mean the operator has finished a GDPR or
          CCPA/CPRA compliance program.
        </p>
        <p>Needs review before those rights can be promised in full:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A recorded lawful basis for each use, including consent, contract, and legitimate interests.</li>
          <li>An international transfer mechanism if account data is hosted outside the user’s country.</li>
          <li>A subprocessor list and signed terms with BitLabs, Cloudflare, Resend, the host, and the database host.</li>
          <li>Whether a representative or data protection officer is required. None is appointed in the product.</li>
          <li>Age checks. The terms say you must be 18 or older. The application does not verify age.</li>
          <li>Cookies set by a survey provider after you leave this site. This application only sets the session cookie described above.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Contact">
        <SupportContact lead="For privacy requests, including access, correction, deletion, or an appeal, email" />
        <p>
          Signed-in requests can also start from the <Link href="/account" className="text-brand">account page</Link>.
          The same address is shown on the <Link href="/contact" className="text-brand">contact page</Link> and in the
          footer.
        </p>
      </LegalSection>
    </article>
  );
}
