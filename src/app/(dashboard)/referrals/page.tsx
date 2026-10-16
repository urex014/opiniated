import type { Metadata } from "next";
import { CopyLinkButton } from "@/components/referrals/copy-link-button";
import { ReferralSummary } from "@/components/referrals/referral-summary";
import { CommissionHistoryTable, DirectReferralsTable } from "@/components/referrals/referral-tables";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { getUserReferralSummary } from "@/lib/referrals/service";

export const metadata: Metadata = { title: "Referrals" };
export const instant = false;

export default async function ReferralsPage() {
  const user = await requireUser();
  const env = readEnv();
  const summary = await getUserReferralSummary(user.id);

  if (!summary) {
    return (
      <>
        <h1 className="page-title">Referrals</h1>
        <p className="mt-2 text-sm text-muted">Unable to load referral profile. Please refresh the page.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Referral Program</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Invite friends to Opiniated and earn 10% of Opiniated&apos;s share on every confirmed survey they complete.
        No sign-up bonus is paid for registrations alone; commissions are generated purely from verified survey earnings.
      </p>

      {/* Referral Link Share Box */}
      <div className="mt-6 rounded-lg border border-line bg-white p-5">
        <h2 className="text-sm font-medium text-ink">Your Unique Referral Link</h2>
        <p className="mt-1 text-xs text-muted">Share this link with your friends or audience. When they register, they will be attributed to your account permanently.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <input
            type="text"
            readOnly
            value={summary.referralLink}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink selection:bg-brand-wash"
          />
          <CopyLinkButton link={summary.referralLink} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Referral Code: <span className="font-mono font-medium text-ink">{summary.referralCode}</span>
        </p>
      </div>

      {/* Metrics Summary */}
      <div className="mt-6">
        <ReferralSummary
          totalInvited={summary.totalInvited}
          pendingCount={summary.pendingCount}
          qualifiedCount={summary.qualifiedCount}
          approvedEarningsUnits={summary.approvedEarningsUnits}
          heldEarningsUnits={summary.heldEarningsUnits}
          reversedEarningsUnits={summary.reversedEarningsUnits}
          currencyCode={env.rewardCurrencyCode}
          factor={env.rewardMinorUnitFactor}
        />
      </div>

      {/* Program Information Alert */}
      <div className="mt-6 rounded-lg border border-line bg-surface p-4 text-xs leading-5 text-muted">
        <p className="font-medium text-ink">How commissions work:</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Gross survey earnings are split: 40% to the survey respondent and 60% to Opiniated.</li>
          <li>You receive 10% of Opiniated&apos;s 60% share (equivalent to 6% of the gross survey value).</li>
          <li>Commissions are added directly to your reward balance and qualify for the standard $5.00 automatic Paystack payout threshold.</li>
          <li>If a survey provider rejects or reverses a survey completion, the corresponding referral commission is reversed accordingly.</li>
        </ul>
      </div>

      {/* Direct Referrals List */}
      <h2 className="section-title mb-3 mt-8">Direct Referrals ({summary.totalInvited})</h2>
      <DirectReferralsTable referrals={summary.referrals} />

      {/* Referral Commission History */}
      <h2 className="section-title mb-3 mt-8">Commission Activity</h2>
      <CommissionHistoryTable
        commissions={summary.commissions}
        currencyCode={env.rewardCurrencyCode}
        factor={env.rewardMinorUnitFactor}
      />
    </>
  );
}
