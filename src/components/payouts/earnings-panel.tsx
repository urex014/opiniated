import { formatReward } from "@/lib/rewards/money";
import { formatUsdFromCents } from "@/lib/payouts/eligibility";

export function EarningsPanel({
  earnedUnits,
  spendableUnits,
  reservedUnits,
  minUsdCents,
  progress,
  notice,
  currencyCode,
  factor,
  bankLabel,
  nextBatch,
}: {
  earnedUnits: number;
  spendableUnits: number;
  reservedUnits: number;
  minUsdCents: number;
  progress: number;
  notice: string;
  currencyCode: string;
  factor: number;
  bankLabel: string;
  nextBatch: string;
}) {
  return (
    <section className="grid gap-4">
      <dl className="balance-card grid sm:grid-cols-2">
        <Stat label="Total earned" value={formatReward(earnedUnits, currencyCode, factor)} />
        <Stat label="Pending rewards" value="None in your balance" />
        <Stat label="Available balance" value={formatReward(spendableUnits, currencyCode, factor)} />
        <Stat label="Scheduled for payout" value={formatReward(reservedUnits, currencyCode, factor)} />
      </dl>
      <div className="rounded-lg border border-line bg-white px-4 py-4">
        <p className="text-[13px] text-muted">Minimum payout threshold</p>
        <p className="mt-1 font-medium">{formatUsdFromCents(minUsdCents)} USD equivalent</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress toward the next payout">
          <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-sm leading-6 text-ink">{notice}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{bankLabel}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{nextBatch}</p>
        <p className="mt-2 text-sm leading-6 text-muted">Unconfirmed survey completions stay out of this balance until a verified callback.</p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line px-4 py-4 first:border-t-0 sm:border-r sm:border-t-0 sm:[&:nth-child(2)]:border-r-0 sm:[&:nth-child(n+3)]:border-t">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
