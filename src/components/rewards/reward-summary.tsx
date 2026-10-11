import { formatReward } from "@/lib/rewards/money";

export function RewardSummary({
  availableUnits,
  lifetimeCreditedUnits,
  currencyCode,
  factor,
}: {
  availableUnits: number;
  lifetimeCreditedUnits: number;
  currencyCode: string;
  factor: number;
}) {
  return (
    <dl className="balance-card grid sm:grid-cols-2">
      <div className="px-4 py-4 sm:border-r sm:border-line">
        <dt className="text-[13px] text-muted">Available balance</dt>
        <dd className="reward-amount balance-figure mt-1">{formatReward(availableUnits, currencyCode, factor)}</dd>
      </div>
      <div className="border-t border-line px-4 py-4 sm:border-t-0">
        <dt className="text-[13px] text-muted">Total approved earnings</dt>
        <dd className="mt-1 text-[2rem] font-medium tabular-nums tracking-tight text-ink">{formatReward(lifetimeCreditedUnits, currencyCode, factor)}</dd>
      </div>
    </dl>
  );
}
