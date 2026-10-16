import { formatReward } from "@/lib/rewards/money";

export function ReferralSummary({
  totalInvited,
  pendingCount,
  qualifiedCount,
  approvedEarningsUnits,
  heldEarningsUnits,
  reversedEarningsUnits,
  currencyCode,
  factor,
}: {
  totalInvited: number;
  pendingCount: number;
  qualifiedCount: number;
  approvedEarningsUnits: number;
  heldEarningsUnits: number;
  reversedEarningsUnits: number;
  currencyCode: string;
  factor: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-[13px] text-muted">Total Invited</p>
        <p className="mt-1 text-2xl font-medium tracking-tight text-ink">{totalInvited}</p>
        <p className="mt-1 text-xs text-muted">
          {qualifiedCount} qualified · {pendingCount} pending
        </p>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-[13px] text-muted">Approved Earnings</p>
        <p className="mt-1 text-2xl font-medium tracking-tight text-brand">
          {formatReward(approvedEarningsUnits, currencyCode, factor)}
        </p>
        <p className="mt-1 text-xs text-muted">10% of Opiniated share credited</p>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-[13px] text-muted">Pending / Under Review</p>
        <p className="mt-1 text-2xl font-medium tracking-tight text-ink">
          {formatReward(heldEarningsUnits, currencyCode, factor)}
        </p>
        <p className="mt-1 text-xs text-muted">Held for fraud or account check</p>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-[13px] text-muted">Reversed Commissions</p>
        <p className="mt-1 text-2xl font-medium tracking-tight text-muted">
          {formatReward(reversedEarningsUnits, currencyCode, factor)}
        </p>
        <p className="mt-1 text-xs text-muted">From survey provider reversals</p>
      </div>
    </div>
  );
}
