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
      <h1 className="page-title">{user.name ? `Hello, ${user.name}` : "Your surveys"}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Surveys matched to this account, and the rewards BitLabs has already confirmed.
      </p>
      <div className="mt-5">
        <RewardSummary
          availableUnits={summary.availableUnits}
          reservedUnits={summary.reservedUnits}
          lifetimeCreditedUnits={summary.lifetimeCreditedUnits}
          currencyCode={env.rewardCurrencyCode}
          factor={env.rewardMinorUnitFactor}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        {env.rewardCurrencyCode === "OPN"
          ? "100 OPN equal $1.00. Available OPN is included in the next payout batch once it reaches $5.00."
          : `Rewards use ${env.rewardCurrencyCode}. Available points stay in your account until a payout batch includes them.`}{" "}
        They are not paid out until Paystack confirms the transfer.
      </p>

      <section className="mt-8 rounded-lg bg-white px-3 py-4 sm:px-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="section-title">Available surveys</h2>
          <Link href="/surveys" className="text-sm font-medium text-brand transition-colors duration-150 hover:text-brand-hover">
            View all
          </Link>
        </div>
        <SurveySection result={surveys} />
      </section>

      <section className="mt-8">
        <h2 className="section-title mb-3">Recent rewards</h2>
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
  if (result.surveys.length === 0) {
    return (
      <EmptySurveys
        restriction={result.restriction}
        detail={result.restriction ? undefined : "When a survey matches this account, it will show up in this list."}
      />
    );
  }
  return <SurveyBrowser surveys={toPublicSurveys(result.surveys).slice(0, 5)} />;
}
