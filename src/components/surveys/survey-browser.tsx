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
            className="field-input ml-2 h-10 w-auto px-2 text-sm"
          >
            <option value="recommended">Recommended</option>
            <option value="reward">Highest reward</option>
            <option value="duration">Shortest duration</option>
          </select>
        </label>
      </div>
      <div className="survey-list">
        <ul>
          {sorted.map((survey) => (
            <li key={survey.id}>
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
    <div className="survey-row sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <h2 className="text-base font-medium leading-snug text-ink">
          <a href={`/surveys/${encodeURIComponent(survey.id)}`} className="transition-colors duration-150 hover:text-brand">
            {survey.title}
          </a>
        </h2>
        <p className="mt-1 text-sm text-muted">
          {survey.durationMinutes === null ? "Estimated time not provided" : `Estimated time: ${formatMinutes(survey.durationMinutes)}`}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">
          {survey.type === "start_bonus" ? "Profile questions" : "Survey"}
          {survey.rating ? ` · Ease ${survey.rating} of 5` : ""}
          {survey.tags.includes("pii") ? " · May ask personal questions" : ""}
          {survey.tags.includes("recontact") ? " · Follow-up survey" : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end">
        <p className="reward-amount">{survey.rewardLabel}</p>
        <form method="post" action="/api/surveys/start">
          <input type="hidden" name="surveyId" value={survey.id} />
          <button type="submit" className="btn btn-primary">
            Start survey
          </button>
        </form>
      </div>
    </div>
  );
}
