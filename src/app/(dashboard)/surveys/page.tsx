import type { Metadata } from "next";
import { SurveyBrowser } from "@/components/surveys/survey-browser";
import { EmptySurveys, SurveyError } from "@/components/surveys/survey-states";
import { requireUser } from "@/lib/auth/current-user";
import { toPublicSurveys } from "@/lib/bitlabs/normalize";
import { requireCurrentConsent } from "@/lib/legal/access";
import { readEnv } from "@/lib/env";
import { rewardUnitExplanation } from "@/lib/rewards/currency";
import { loadSurveysForUser } from "@/lib/surveys/load";

export const metadata: Metadata = { title: "Available surveys" };
export const instant = false;

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  await requireCurrentConsent(user.id, "/surveys");
  const params = await searchParams;
  const env = readEnv();
  const result = await loadSurveysForUser(user.id);

  return (
    <>
      <h1 className="page-title">Available surveys</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Surveys are available only on a signed-in account. The amount shown is the provider&apos;s estimate. Opening a
        survey does not add a reward. {rewardUnitExplanation(env.rewardCurrencyCode, env.rewardMinorUnitFactor)}
      </p>
      {params.error && result.ok ? (
        <div className="mt-4">
          <SurveyError code={params.error} />
        </div>
      ) : null}
      <div className="mt-5">
        {!result.ok ? (
          <SurveyError code={result.error} />
        ) : result.surveys.length === 0 ? (
          <EmptySurveys restriction={result.restriction} />
        ) : (
          <>
            {result.restriction ? (
              <p className="mb-3 text-sm text-muted">{result.restriction.message}</p>
            ) : null}
            <SurveyBrowser surveys={toPublicSurveys(result.surveys)} />
          </>
        )}
      </div>
    </>
  );
}
