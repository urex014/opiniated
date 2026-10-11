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
    <dl className="grid gap-4 border border-line bg-white p-4 sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted">Available balance</dt>
        <dd className="mt-1 text-2xl font-medium text-ink">{formatReward(availableUnits, currencyCode, factor)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Total approved earnings</dt>
        <dd className="mt-1 text-2xl font-medium text-ink">{formatReward(lifetimeCreditedUnits, currencyCode, factor)}</dd>
      </div>
    </dl>
  );
}
