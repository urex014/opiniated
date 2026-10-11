import type { Metadata } from "next";
import Link from "next/link";
import { RewardSummary } from "@/components/rewards/reward-summary";
import { SurveyBrowser } from "@/components/surveys/survey-browser";
import { EmptySurveys, SurveyError } from "@/components/surveys/survey-states";
import { TransactionTable } from "@/components/rewards/transaction-table";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { toPublicSurveys } from "@/lib/bitlabs/normalize";
import { getRewardSummary } from "@/lib/rewards/queries";
import { loadSurveysForUser } from "@/lib/surveys/load";

export const metadata: Metadata = { title: "Overview" };
export const instant = false;

export default async function DashboardPage() {
  const user = await requireUser();
  const env = readEnv();
  const [summary, surveys] = await Promise.all([getRewardSummary(user.id), loadSurveysForUser(user.id)]);

  return (
    <>
      <h1 className="text-[28px] font-medium">Overview</h1>
      <p className="mt-1 text-sm text-muted">Your balance and the surveys available to this account.</p>
      <div className="mt-5">
        <RewardSummary
          availableUnits={summary.availableUnits}
          lifetimeCreditedUnits={summary.lifetimeCreditedUnits}
          currencyCode={env.rewardCurrencyCode}
          factor={env.rewardMinorUnitFactor}
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        Rewards use {env.rewardCurrencyCode}. A balance here is a credited record, not a payout.
      </p>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">Available surveys</h2>
          <Link href="/surveys" className="text-sm text-brand">
            View all
          </Link>
        </div>
        <SurveySection result={surveys} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Recent rewards</h2>
        <TransactionTable
          transactions={summary.transactions}
          currencyCode={env.rewardCurrencyCode}
          factor={env.rewardMinorUnitFactor}
        />
      </section>
    </>
  );
}

function SurveySection({
  result,
}: {
  result: Awaited<ReturnType<typeof loadSurveysForUser>>;
}) {
  if (!result.ok) return <SurveyError code={result.error} />;
  if (result.surveys.length === 0) return <EmptySurveys restriction={result.restriction} />;
  return <SurveyBrowser surveys={toPublicSurveys(result.surveys).slice(0, 5)} />;
}
