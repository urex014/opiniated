import { formatReward } from "@/lib/rewards/money";
import { withdrawalNextStep, withdrawalStatusLabel } from "@/lib/payouts/labels";
import { pointsToKobo } from "@/lib/payouts/money";
import type { WithdrawalStatus } from "@/lib/payouts/constants";

export function PayoutSummary({
  spendableUnits,
  reservedUnits,
  minimumPoints,
  currencyCode,
  factor,
  koboPerPoint,
}: {
  spendableUnits: number;
  reservedUnits: number;
  minimumPoints: number | null;
  currencyCode: string;
  factor: number;
  koboPerPoint: number | null;
}) {
  return (
    <dl className="balance-card grid sm:grid-cols-3">
      <div className="px-4 py-4 sm:border-r sm:border-line">
        <dt className="text-[13px] text-muted">Available to withdraw</dt>
        <dd className="reward-amount balance-figure mt-1">{formatReward(spendableUnits, currencyCode, factor)}</dd>
      </div>
      <div className="border-t border-line px-4 py-4 sm:border-t-0 sm:border-r sm:border-line">
        <dt className="text-[13px] text-muted">Reserved for withdrawal</dt>
        <dd className="mt-1 text-[2rem] font-medium tabular-nums tracking-tight text-ink">{formatReward(reservedUnits, currencyCode, factor)}</dd>
      </div>
      <div className="border-t border-line px-4 py-4 sm:border-t-0">
        <dt className="text-[13px] text-muted">Minimum withdrawal</dt>
        <dd className="mt-1 text-sm leading-6 text-ink">{minimumLabel(minimumPoints, koboPerPoint, currencyCode, factor)}</dd>
      </div>
    </dl>
  );
}

export function WithdrawalHistory({
  rows,
  currencyCode,
  factor,
}: {
  rows: { id: string; requestedAt: Date; points: number; amountKobo: number; status: WithdrawalStatus; failureReason: string | null }[];
  currencyCode: string;
  factor: number;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-line bg-white px-4 py-6 text-sm leading-6 text-muted">No payouts yet.</p>;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
      {rows.map((row) => (
        <li key={row.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{withdrawalStatusLabel(row.status)}</p>
              <p className="text-xs text-muted">{formatWhen(row.requestedAt)}</p>
            </div>
            <p className="text-right text-sm">
              <span className="block font-medium tabular-nums">{formatReward(row.points, currencyCode, factor)}</span>
              <span className="text-muted">{formatReward(row.amountKobo, "NGN", 100)}</span>
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">{withdrawalNextStep(row.status, row.failureReason)}</p>
        </li>
      ))}
    </ul>
  );
}

function minimumLabel(points: number | null, koboPerPoint: number | null, currencyCode: string, factor: number): string {
  if (points == null || koboPerPoint == null) return "Not configured";
  const kobo = pointsToKobo(points, koboPerPoint);
  if (kobo == null) return formatReward(points, currencyCode, factor);
  return `${formatReward(points, currencyCode, factor)} (${formatReward(kobo, "NGN", 100)})`;
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
