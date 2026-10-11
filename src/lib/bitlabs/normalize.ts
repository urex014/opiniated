import { z } from "zod";
import { isAllowedSurveyClickUrl } from "@/lib/security/click-url";
import { formatReward, parseRewardUnits } from "@/lib/rewards/money";
import { restrictionFromPayload } from "@/lib/bitlabs/restrictions";
import type { ProviderSurvey, PublicSurvey, SurveyFetchResult, SurveyRestriction } from "@/lib/bitlabs/types";

const surveySchema = z.object({
  id: z.string().min(1),
  type: z.enum(["survey", "start_bonus"]).optional(),
  click_url: z.string().min(1),
  value: z.string(),
  loi: z.number().nonnegative().optional(),
  country: z.string().optional(),
  rating: z.number().int().optional(),
  category: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});

const responseSchema = z.object({
  data: z.object({
    surveys: z.array(z.unknown()).optional(),
    restriction_reason: z.unknown().optional(),
  }),
});

export function normalizeSurveyPayload(
  payload: unknown,
  currencyCode: string,
  minorUnitFactor: number,
): SurveyFetchResult | { ok: false; error: "malformed" } {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "malformed" };

  const restriction: SurveyRestriction | null = restrictionFromPayload(parsed.data.data.restriction_reason);
  const rawSurveys = parsed.data.data.surveys;
  if (!rawSurveys) {
    if (restriction) return { ok: true, surveys: [], restriction };
    return { ok: false, error: "malformed" };
  }

  const surveys: ProviderSurvey[] = [];
  let invalidCount = 0;
  for (const item of rawSurveys) {
    const survey = surveySchema.safeParse(item);
    if (!survey.success || !isAllowedSurveyClickUrl(survey.data.click_url)) {
      invalidCount += 1;
      continue;
    }
    const rewardUnits = parseRewardUnits(survey.data.value, minorUnitFactor);
    if (rewardUnits === null || rewardUnits < 0) {
      invalidCount += 1;
      continue;
    }
    const type = survey.data.type ?? "survey";
    const category = survey.data.category?.name?.trim() || null;
    const tags = (survey.data.tags ?? []).filter(
      (tag): tag is "pii" | "recontact" => tag === "pii" || tag === "recontact",
    );
    surveys.push({
      id: survey.data.id,
      type,
      title: category || (type === "start_bonus" ? "Profile questions" : "Survey"),
      rewardUnits,
      rewardLabel: formatReward(rewardUnits, currencyCode, minorUnitFactor),
      durationMinutes: survey.data.loi ?? null,
      rating: survey.data.rating ?? null,
      country: survey.data.country ?? null,
      category,
      tags,
      clickUrl: survey.data.click_url,
    });
  }

  if (rawSurveys.length > 0 && surveys.length === 0 && invalidCount === rawSurveys.length) {
    return { ok: false, error: "malformed" };
  }

  return { ok: true, surveys, restriction };
}

export function toPublicSurveys(surveys: ProviderSurvey[]): PublicSurvey[] {
  return surveys.map((survey) => ({
    id: survey.id,
    type: survey.type,
    title: survey.title,
    rewardUnits: survey.rewardUnits,
    rewardLabel: survey.rewardLabel,
    durationMinutes: survey.durationMinutes,
    rating: survey.rating,
    country: survey.country,
    category: survey.category,
    tags: survey.tags,
  }));
}
