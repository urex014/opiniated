import { formatReward } from "@/lib/rewards/money";

export function DirectReferralsTable({
  referrals,
}: {
  referrals: Array<{
    id: string;
    maskedEmail: string;
    signupDate: Date;
    isQualified: boolean;
  }>;
}) {
  if (referrals.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-muted">
        No friends have signed up with your referral link yet. Share your link above to start earning commissions.
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-surface text-xs font-medium text-muted">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {referrals.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-ink">{r.maskedEmail}</td>
              <td className="px-4 py-3 text-muted">
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(r.signupDate)}
              </td>
              <td className="px-4 py-3 text-right">
                {r.isQualified ? (
                  <span className="inline-flex items-center rounded-full bg-brand-wash px-2.5 py-0.5 text-xs font-medium text-brand">
                    Qualified
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
                    Pending survey
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommissionHistoryTable({
  commissions,
  currencyCode,
  factor,
}: {
  commissions: Array<{
    id: string;
    amountUnits: number;
    status: string;
    eventType: string;
    createdAt: Date;
    surveyTxId: string;
  }>;
  currencyCode: string;
  factor: number;
}) {
  if (commissions.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-muted">
        No referral commissions generated yet. When your referred friends complete eligible surveys, your 10% share appears here.
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-surface text-xs font-medium text-muted">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Activity</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Commission</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {commissions.map((c) => {
            const isNegative = c.amountUnits < 0 || c.eventType === "REVERSAL";
            return (
              <tr key={c.id}>
                <td className="px-4 py-3 text-muted">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(c.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium text-ink">
                  {c.eventType === "REVERSAL" ? "Survey Reversal" : "Survey Completion"}
                  <span className="block text-xs font-normal text-muted">Ref: {c.surveyTxId}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status === "APPROVED"
                        ? "bg-brand-wash text-brand"
                        : c.status === "HELD"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${isNegative ? "text-muted" : "text-brand"}`}>
                  {isNegative ? "-" : "+"}
                  {formatReward(Math.abs(c.amountUnits), currencyCode, factor)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
