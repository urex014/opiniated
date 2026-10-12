import { formatReward } from "@/lib/rewards/money";

export function RewardSummary({
  availableUnits,
  reservedUnits = 0,
  lifetimeCreditedUnits,
  currencyCode,
  factor,
}: {
  availableUnits: number;
  reservedUnits?: number;
  lifetimeCreditedUnits: number;
  currencyCode: string;
  factor: number;
}) {
  const spendable = Math.max(0, availableUnits - reservedUnits);
  return (
    <dl className="balance-card grid sm:grid-cols-3">
      <div className="px-4 py-4 sm:border-r sm:border-line">
        <dt className="text-[13px] text-muted">Available to withdraw</dt>
        <dd className="reward-amount balance-figure mt-1">{formatReward(spendable, currencyCode, factor)}</dd>
      </div>
      <div className="border-t border-line px-4 py-4 sm:border-t-0 sm:border-r sm:border-line">
        <dt className="text-[13px] text-muted">Reserved</dt>
        <dd className="mt-1 text-[2rem] font-medium tabular-nums tracking-tight text-ink">{formatReward(reservedUnits, currencyCode, factor)}</dd>
      </div>
      <div className="border-t border-line px-4 py-4 sm:border-t-0">
        <dt className="text-[13px] text-muted">Total approved earnings</dt>
        <dd className="mt-1 text-[2rem] font-medium tabular-nums tracking-tight text-ink">{formatReward(lifetimeCreditedUnits, currencyCode, factor)}</dd>
      </div>
    </dl>
  );
}
