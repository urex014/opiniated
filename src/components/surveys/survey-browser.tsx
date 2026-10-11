"use client";

import { useMemo, useState } from "react";
import { formatMinutes } from "@/lib/rewards/money";
import type { PublicSurvey } from "@/lib/bitlabs/types";

export function SurveyBrowser({ surveys }: { surveys: PublicSurvey[] }) {
  const [sort, setSort] = useState<"recommended" | "reward" | "duration">("recommended");
  const sorted = useMemo(() => {
    const copy = [...surveys];
    if (sort === "reward") copy.sort((a, b) => b.rewardUnits - a.rewardUnits);
    if (sort === "duration") {
      copy.sort((a, b) => (a.durationMinutes ?? Number.POSITIVE_INFINITY) - (b.durationMinutes ?? Number.POSITIVE_INFINITY));
    }
    return copy;
  }, [surveys, sort]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{surveys.length} available</p>
        <label className="text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="ml-2 h-9 rounded-md border border-line bg-white px-2 text-sm text-ink"
          >
            <option value="recommended">Recommended</option>
            <option value="reward">Highest reward</option>
            <option value="duration">Shortest duration</option>
          </select>
        </label>
      </div>
      <div className="border-y border-line bg-white">
        <ul>
          {sorted.map((survey) => (
            <li key={survey.id} className="border-b border-line px-4 py-4 last:border-b-0">
              <SurveyRow survey={survey} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SurveyRow({ survey }: { survey: PublicSurvey }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <h2 className="text-base font-medium text-ink">
          <a href={`/surveys/${encodeURIComponent(survey.id)}`} className="hover:text-brand">
            {survey.title}
          </a>
        </h2>
        <p className="mt-1 text-sm text-muted">
          {survey.durationMinutes === null ? "Estimated time not provided" : `Estimated time: ${formatMinutes(survey.durationMinutes)}`}
        </p>
        <p className="mt-1 text-xs text-muted">
          {survey.type === "start_bonus" ? "Profile questions" : "Survey"}
          {survey.rating ? ` · Ease ${survey.rating} of 5` : ""}
          {survey.tags.includes("pii") ? " · May ask personal questions" : ""}
          {survey.tags.includes("recontact") ? " · Follow-up survey" : ""}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
        <p className="text-lg font-medium text-ink">{survey.rewardLabel}</p>
        <form method="post" action="/api/surveys/start" className="sm:mt-2">
          <input type="hidden" name="surveyId" value={survey.id} />
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Start survey
          </button>
        </form>
      </div>
    </div>
  );
}
