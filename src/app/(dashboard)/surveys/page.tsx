import type { Metadata } from "next";
import { SurveyBrowser } from "@/components/surveys/survey-browser";
import { EmptySurveys, SurveyError } from "@/components/surveys/survey-states";
import { requireUser } from "@/lib/auth/current-user";
import { toPublicSurveys } from "@/lib/bitlabs/normalize";
import { loadSurveysForUser } from "@/lib/surveys/load";

export const metadata: Metadata = { title: "Available surveys" };
export const instant = false;

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const result = await loadSurveysForUser(user.id);

  return (
    <>
      <h1 className="text-[28px] font-medium">Available surveys</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Find surveys that match your profile and earn rewards for your participation.
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
