import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { requireCurrentConsent } from "@/lib/legal/access";
import { formatMinutes } from "@/lib/rewards/money";
import { loadSurveysForUser } from "@/lib/surveys/load";

export const metadata: Metadata = { title: "Survey" };
export const instant = false;

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  if (!surveyId) notFound();
  const user = await requireUser();
  await requireCurrentConsent(user.id, `/surveys/${surveyId}`);
  const result = await loadSurveysForUser(user.id);
  const survey = result.ok ? result.surveys.find((item) => item.id === surveyId) : undefined;

  return (
    <>
      <p className="text-sm">
        <Link href="/surveys" className="text-brand">
          Back to surveys
        </Link>
      </p>
      {!result.ok ? (
        <h1 className="page-title mt-4">Survey unavailable</h1>
      ) : !survey ? (
        <>
          <h1 className="page-title mt-4">This survey is no longer listed</h1>
          <p className="mt-2 text-sm text-muted">It may have filled or you may no longer qualify. Return to the list for current surveys.</p>
        </>
      ) : (
        <>
          <h1 className="page-title mt-4">{survey.title}</h1>
          <dl className="mt-4 grid gap-3 rounded-lg border border-line bg-white p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Reward</dt>
              <dd className="reward-amount mt-1">{survey.rewardLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Estimated time</dt>
              <dd className="mt-1">{survey.durationMinutes === null ? "Not provided" : formatMinutes(survey.durationMinutes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Survey reference</dt>
              <dd className="mt-1 break-all">{survey.id}</dd>
            </div>
            {survey.rating ? (
              <div>
                <dt className="text-xs text-muted">Average rating</dt>
                <dd className="mt-1">{survey.rating} of 5</dd>
              </div>
            ) : null}
          </dl>
          {survey.tags.includes("pii") ? (
            <p className="mt-3 text-sm text-muted">This survey may ask for personal information.</p>
          ) : null}
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            The reward is added only after the provider sends a verified completion. Returning to this site, or saying
            the survey is finished, does not change your balance.
          </p>
          <form method="post" action="/api/surveys/start" className="mt-5">
            <input type="hidden" name="surveyId" value={survey.id} />
            <button type="submit" className="btn btn-primary btn-lg">
              Start survey
            </button>
          </form>
        </>
      )}
    </>
  );
}
