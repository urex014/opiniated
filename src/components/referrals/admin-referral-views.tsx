import { formatReward } from "@/lib/rewards/money";
import { toggleCommissionHoldAction, updateReferralRateAction } from "@/lib/referrals/admin-actions";

export function AdminFinancialReport({
  grossRevenueUnits,
  userRewardUnits,
  opiniatedShareUnits,
  commissionUnits,
  netRetainedUnits,
  currencyCode,
  factor,
}: {
  grossRevenueUnits: number;
  userRewardUnits: number;
  opiniatedShareUnits: number;
  commissionUnits: number;
  netRetainedUnits: number;
  currencyCode: string;
  factor: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-lg border border-line bg-white p-4">
        <dt className="text-xs font-medium text-muted">Gross Survey Value (100%)</dt>
        <dd className="mt-1 text-xl font-medium tracking-tight text-ink">
          {formatReward(grossRevenueUnits, currencyCode, factor)}
        </dd>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <dt className="text-xs font-medium text-muted">User Rewards (40%)</dt>
        <dd className="mt-1 text-xl font-medium tracking-tight text-ink">
          {formatReward(userRewardUnits, currencyCode, factor)}
        </dd>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <dt className="text-xs font-medium text-muted">Opiniated Gross Share (60%)</dt>
        <dd className="mt-1 text-xl font-medium tracking-tight text-ink">
          {formatReward(opiniatedShareUnits, currencyCode, factor)}
        </dd>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <dt className="text-xs font-medium text-brand">Referral Commissions</dt>
        <dd className="mt-1 text-xl font-medium tracking-tight text-brand">
          {formatReward(commissionUnits, currencyCode, factor)}
        </dd>
        <p className="mt-0.5 text-[11px] text-muted">10% of Opiniated share</p>
      </div>
      <div className="rounded-lg border border-line bg-brand-wash p-4">
        <dt className="text-xs font-medium text-brand">Net Retained Revenue</dt>
        <dd className="mt-1 text-xl font-medium tracking-tight text-ink">
          {formatReward(netRetainedUnits, currencyCode, factor)}
        </dd>
        <p className="mt-0.5 text-[11px] text-muted">Retained before platform costs</p>
      </div>
    </div>
  );
}

export function AdminRateConfig({ currentRateBps }: { currentRateBps: number }) {
  const currentPercent = (currentRateBps / 100).toFixed(1);
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <h3 className="text-sm font-medium text-ink">Referral Commission Rate</h3>
      <p className="mt-1 text-xs text-muted">
        Configure the percentage of Opiniated&apos;s 60% gross share paid to referrers. Defaults to 10.0%.
      </p>
      <form action={updateReferralRateAction} className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="1.0"
            max="50.0"
            name="ratePercent"
            defaultValue={currentPercent}
            required
            className="w-28 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink"
          />
          <span className="text-sm text-muted">% of Opiniated share</span>
        </div>
        <button type="submit" className="btn btn-secondary btn-sm">
          Save Commission Rate
        </button>
      </form>
    </div>
  );
}

export function AdminCommissionsTable({
  commissions,
  currencyCode,
  factor,
}: {
  commissions: Array<{
    id: string;
    referrerEmail: string;
    referredEmail: string;
    amountUnits: number;
    status: string;
    eventType: string;
    holdReason: string | null;
    createdAt: Date;
    providerTxId: string;
  }>;
  currencyCode: string;
  factor: number;
}) {
  if (commissions.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-muted">
        No commission records match your criteria.
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-surface text-xs font-medium text-muted">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Referrer</th>
            <th className="px-4 py-3">Referred User</th>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Commission</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {commissions.map((c) => {
            const isNegative = c.amountUnits < 0 || c.eventType === "REVERSAL";
            return (
              <tr key={c.id}>
                <td className="px-4 py-3 text-muted">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(c.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium text-ink">{c.referrerEmail}</td>
                <td className="px-4 py-3 text-muted">{c.referredEmail}</td>
                <td className="px-4 py-3 text-xs text-muted">{c.eventType}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === "APPROVED"
                        ? "bg-brand-wash text-brand"
                        : c.status === "HELD"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.holdReason ? (
                    <span className="block text-[11px] text-amber-700">{c.holdReason}</span>
                  ) : null}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${isNegative ? "text-muted" : "text-brand"}`}>
                  {isNegative ? "-" : "+"}
                  {formatReward(Math.abs(c.amountUnits), currencyCode, factor)}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.status === "APPROVED" && c.eventType === "CREDIT" ? (
                    <form action={toggleCommissionHoldAction} className="inline-flex items-center gap-1">
                      <input type="hidden" name="commissionId" value={c.id} />
                      <input type="hidden" name="action" value="hold" />
                      <input type="hidden" name="reason" value="Suspicious referral activity flagged by admin" />
                      <button type="submit" className="text-xs text-amber-700 hover:underline">
                        Hold
                      </button>
                    </form>
                  ) : null}
                  {c.status === "HELD" ? (
                    <form action={toggleCommissionHoldAction} className="inline-flex items-center gap-1">
                      <input type="hidden" name="commissionId" value={c.id} />
                      <input type="hidden" name="action" value="release" />
                      <input type="hidden" name="reason" value="Reviewed and approved by admin" />
                      <button type="submit" className="text-xs text-brand hover:underline">
                        Release
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
