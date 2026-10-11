import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
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
        <h1 className="mt-4 text-[28px] font-medium">Survey unavailable</h1>
      ) : !survey ? (
        <>
          <h1 className="mt-4 text-[28px] font-medium">This survey is no longer listed</h1>
          <p className="mt-2 text-sm text-muted">It may have filled or you may no longer qualify. Return to the list for current surveys.</p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-[28px] font-medium">{survey.title}</h1>
          <dl className="mt-4 grid gap-3 border border-line bg-white p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Reward</dt>
              <dd className="mt-1 text-lg font-medium">{survey.rewardLabel}</dd>
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
                <dt className="text-xs text-muted">Ease rating</dt>
                <dd className="mt-1">{survey.rating} of 5. The provider uses 5 for easier and 1 for harder.</dd>
              </div>
            ) : null}
          </dl>
          {survey.tags.includes("pii") ? (
            <p className="mt-3 text-sm text-muted">BitLabs marked this survey as one that may ask for personal information.</p>
          ) : null}
          <form method="post" action="/api/surveys/start" className="mt-5">
            <input type="hidden" name="surveyId" value={survey.id} />
            <button type="submit" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover">
              Start survey
            </button>
          </form>
        </>
      )}
    </>
  );
}
