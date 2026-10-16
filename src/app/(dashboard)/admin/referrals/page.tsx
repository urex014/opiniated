import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminCommissionsTable,
  AdminFinancialReport,
  AdminRateConfig,
} from "@/components/referrals/admin-referral-views";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/payouts/access";
import { getAdminReferralOverview } from "@/lib/referrals/service";

export const metadata: Metadata = { title: "Referrals Admin" };
export const instant = false;

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; error?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const env = readEnv();
  if (!isAdminEmail(user.email, env.adminEmails)) notFound();

  const params = await searchParams;
  const overview = await getAdminReferralOverview();

  const whereClause: Record<string, unknown> = {};
  if (params.status && ["APPROVED", "HELD", "REVERSED"].includes(params.status)) {
    whereClause.status = params.status;
  }

  const rawCommissions = await prisma.referralCommission.findMany({
    where: whereClause,
    include: {
      referrer: { select: { email: true } },
      referred: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const commissions = rawCommissions.map((c) => ({
    id: c.id,
    referrerEmail: c.referrer.email,
    referredEmail: c.referred.email,
    amountUnits: c.amountUnits,
    status: c.status,
    eventType: c.eventType,
    holdReason: c.holdReason,
    createdAt: c.createdAt,
    providerTxId: c.providerTxId,
  }));

  return (
    <>
      <h1 className="page-title">Referral Management</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Review platform-wide referral metrics, adjust the revenue-sharing commission rate, review suspicious referral activity, and inspect the financial split.
      </p>

      {params.saved === "rate" ? (
        <div className="mt-4 rounded-md border border-line bg-brand-wash p-3 text-sm text-brand">
          Referral commission rate successfully updated.
        </div>
      ) : null}
      {params.saved === "hold" ? (
        <div className="mt-4 rounded-md border border-line bg-amber-50 p-3 text-sm text-amber-700">
          Commission successfully placed on hold.
        </div>
      ) : null}
      {params.saved === "release" ? (
        <div className="mt-4 rounded-md border border-line bg-brand-wash p-3 text-sm text-brand">
          Commission released and credited to referrer.
        </div>
      ) : null}
      {params.error ? (
        <div className="mt-4 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          Action failed: {decodeURIComponent(params.error)}
        </div>
      ) : null}

      {/* Financial Reporting */}
      <h2 className="section-title mb-3 mt-6">Financial Revenue Split</h2>
      <AdminFinancialReport
        grossRevenueUnits={overview.grossProviderRevenueUnits}
        userRewardUnits={overview.totalUserRewardUnits}
        opiniatedShareUnits={overview.totalOpiniatedShareUnits}
        commissionUnits={overview.approvedCommissionsUnits}
        netRetainedUnits={overview.netRetainedRevenueUnits}
        currencyCode={env.rewardCurrencyCode}
        factor={env.rewardMinorUnitFactor}
      />

      {/* Program Performance */}
      <h2 className="section-title mb-3 mt-8">Performance & Qualification</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-4">
          <dt className="text-xs text-muted">Total Attributed Referrals</dt>
          <dd className="mt-1 text-2xl font-medium tracking-tight text-ink">{overview.totalReferrals}</dd>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <dt className="text-xs text-muted">Qualified Referrals (≥1 Survey)</dt>
          <dd className="mt-1 text-2xl font-medium tracking-tight text-ink">{overview.qualifiedReferrals}</dd>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <dt className="text-xs text-muted">Qualification Rate</dt>
          <dd className="mt-1 text-2xl font-medium tracking-tight text-brand">{overview.qualificationRate}%</dd>
        </div>
      </div>

      {/* Rate Configuration */}
      <div className="mt-8">
        <AdminRateConfig currentRateBps={overview.currentRateBps} />
      </div>

      {/* Commissions Filter & List */}
      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Commissions & Fraud Review</h2>
        <div className="flex gap-2 text-xs">
          <a
            href="/admin/referrals"
            className={`rounded-md px-2.5 py-1 ${!params.status ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
          >
            All
          </a>
          <a
            href="/admin/referrals?status=APPROVED"
            className={`rounded-md px-2.5 py-1 ${params.status === "APPROVED" ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
          >
            Approved
          </a>
          <a
            href="/admin/referrals?status=HELD"
            className={`rounded-md px-2.5 py-1 ${params.status === "HELD" ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
          >
            Held
          </a>
          <a
            href="/admin/referrals?status=REVERSED"
            className={`rounded-md px-2.5 py-1 ${params.status === "REVERSED" ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
          >
            Reversed
          </a>
        </div>
      </div>
      <AdminCommissionsTable
        commissions={commissions}
        currencyCode={env.rewardCurrencyCode}
        factor={env.rewardMinorUnitFactor}
      />

      {/* Audit Log */}
      <h2 className="section-title mb-3 mt-8">Referral Audit Trail</h2>
      <div className="table-shell">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-medium text-muted">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white text-xs">
            {overview.recentAudits.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-muted">
                  No administrative audits recorded yet.
                </td>
              </tr>
            ) : (
              overview.recentAudits.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-muted">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "medium" }).format(a.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{a.actorId ?? "System"}</td>
                  <td className="px-4 py-3 text-muted">{a.action}</td>
                  <td className="px-4 py-3 text-muted">{a.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
