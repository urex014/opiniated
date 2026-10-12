import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SurveyBrowser } from "@/components/surveys/survey-browser";
import { EmptySurveys, SurveyError, SurveySkeleton } from "@/components/surveys/survey-states";
import type { PublicSurvey } from "@/lib/survey-providers/types";

const survey: PublicSurvey = {
  id: "survey-1",
  type: "survey",
  title: "Shopping habits",
  rewardUnits: 75,
  rewardLabel: "75 PTS",
  durationMinutes: 8,
  rating: 4,
  country: "US",
  category: "Shopping habits",
  tags: [],
};

describe("survey states", () => {
  it("renders a stable skeleton", () => {
    const html = renderToStaticMarkup(<SurveySkeleton />);
    expect(html).toContain("bg-surface");
  });

  it("renders the empty state without fake surveys", () => {
    const html = renderToStaticMarkup(<EmptySurveys restriction={null} />);
    expect(html).toContain("No surveys available right now");
    expect(html).toContain("Refresh surveys");
    expect(html).not.toContain("Start survey");
  });

  it("renders a provider error with a retry action", () => {
    const html = renderToStaticMarkup(<SurveyError code="timeout" />);
    expect(html).toContain("took too long");
    expect(html).toContain("Retry");
  });

  it("renders normalized survey data and the start action", () => {
    const html = renderToStaticMarkup(<SurveyBrowser surveys={[survey]} />);
    expect(html).toContain("Shopping habits");
    expect(html).toContain("75 PTS");
    expect(html).toContain("8 minutes");
    expect(html).toContain("Start survey");
    expect(html).toContain('action="/api/surveys/start"');
  });
});
