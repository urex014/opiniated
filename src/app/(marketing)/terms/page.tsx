import type { Metadata } from "next";
import Link from "next/link";
import { LegalDraftNotice, LegalSection } from "@/components/legal/document";
import { SupportContact } from "@/components/legal/support-contact";
import { POLICY_VERSIONS } from "@/lib/legal/versions";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
      <header>
        <h1 className="page-title">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted">Version {POLICY_VERSIONS.terms}</p>
        {/* <LegalDraftNotice /> */}
      </header>

      <LegalSection title="Eligibility and accounts">
        <p>
          You need an Opiniated account to view or start rewarded surveys. You must be at least 18 years old and able
          to form a contract. The application does not verify your age. You agree that the email you register is yours
          and that you will keep the password private. One person, one account.
        </p>
        <p>
          Registration requires a separate, unchecked acceptance of the current{" "}
          <Link href="/privacy" className="text-brand">Privacy Policy</Link> and these terms. Accepting them later, on
          a renewal screen, is recorded as a renewal. It does not replace the registration record.
        </p>
      </LegalSection>

      <LegalSection title="Surveys and rewards">
        <p>
          Survey availability, qualification, length, and the estimated reward come from the provider that supplies the
          survey. In this version that provider is BitLabs, when the operator has configured it. TheoremReach is not
          connected and does not supply surveys or callbacks here.
        </p>
        <p>
          A reward is added only after a verified provider callback for your account. Leaving the survey, returning to
          this site, or telling us you finished does not credit a reward. Screen-outs, duplicate callbacks, unknown
          accounts, and callbacks that fail verification do not increase the balance. A later reversal can reduce the
          available balance, not below zero. The history of the original credit stays in the ledger.
        </p>
        <p>
          The default balance is Opiniated Points (PTS): one point is one integer unit. This installation does not set
          a cash value for a point and does not offer withdrawals or redemptions. If the operator configures a
          different currency code and minor-unit factor, the rewards page states that conversion. Points are not a bank
          balance, wages, or a promise that a survey will be available or that a completion will qualify.
        </p>
      </LegalSection>

      <LegalSection title="Prohibited use">
        <p>You may not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create or use more than one account, or share an account.</li>
          <li>Use a bot, script, or other automation to register, answer surveys, or call reward endpoints.</li>
          <li>Misrepresent your identity, location, or eligibility to a survey provider.</li>
          <li>Attempt to credit your own balance, replay a callback, or interfere with callback verification.</li>
          <li>Probe, scrape, or overload the service except through the pages provided for normal use.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Reversals, suspension, and disputes">
        <p>
          A credit that fails callback verification is not added. A provider reversal reduces the available balance, as
          described above, and the original row stays in the history. This version has no separate suspension switch.
          Closing an account uses deletion: the person can no longer sign in, and the anonymized ledger stays in the
          database. An operator control for suspending an account without deleting it is not built yet.
        </p>
        <p>
          If you disagree with a balance, email support with the account email and the transaction time shown in your
          history. The operator will compare that row with the provider callback. A provider’s decision that a
          completion did not qualify is the provider’s decision. This site cannot pay a reward the provider did not
          confirm.
        </p>
      </LegalSection>

      <LegalSection title="Ending an account">
        <p>
          You can delete the account from the account page. Deletion removes the email, name, and password and signs
          you out. Anonymized reward, survey, and consent records may be kept as described in the Privacy Policy. The
          operator may also close an account that breaks these terms or that a provider identifies as abusive.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <SupportContact lead="Questions about these terms, a reward, or a suspension go to" />
        <p>
          The same address is on the <Link href="/contact" className="text-brand">contact page</Link>, the privacy
          policy, and the footer.
        </p>
        {/* <p>
          Needs review: the operator’s legal name, mailing address, governing law, and any liability limit still have
          to be added by counsel before a public launch. These terms do not set those.
        </p> */}
      </LegalSection>
    </article>
  );
}
