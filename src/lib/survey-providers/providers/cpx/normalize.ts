import { z } from "zod";
import { formatReward, parseRewardUnits } from "@/lib/rewards/money";
import { isCpxLaunchUrl } from "@/lib/survey-providers/registry";
import type { ProviderSurvey } from "@/lib/survey-providers/types";

const itemSchema = z.object({
  id: z.union([z.string().min(1), z.number()]),
  loi: z.union([z.string(), z.number()]).optional(),
  payout: z.union([z.string(), z.number()]),
  href: z.string().optional(),
  href_new: z.string().optional(),
  statistics_rating_avg: z.union([z.string(), z.number()]).optional(),
});

const responseSchema = z.object({
  surveys: z.array(z.unknown()).optional(),
});

export function normalizeCpxSurveys(
  payload: unknown,
  currencyCode: string,
  minorUnitFactor: number,
): { ok: true; surveys: ProviderSurvey[] } | { ok: false; error: "malformed" } {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.surveys) return { ok: false, error: "malformed" };

  const surveys: ProviderSurvey[] = [];
  let invalidCount = 0;
  for (const item of parsed.data.surveys) {
    const survey = itemSchema.safeParse(item);
    const launch = survey.success ? launchUrl(survey.data.href_new, survey.data.href) : null;
    const payout = survey.success ? payoutText(survey.data.payout) : null;
    const rewardUnits = payout === null ? null : parseRewardUnits(payout, minorUnitFactor);
    if (!survey.success || !launch || rewardUnits === null || rewardUnits < 0) {
      invalidCount += 1;
      continue;
    }
    const id = String(survey.data.id).trim();
    if (!id || id.length > 128) {
      invalidCount += 1;
      continue;
    }
    surveys.push({
      id,
      type: "survey",
      title: "Survey",
      rewardUnits,
      rewardLabel: formatReward(rewardUnits, currencyCode, minorUnitFactor),
      durationMinutes: minutes(survey.data.loi),
      rating: rating(survey.data.statistics_rating_avg),
      country: null,
      category: null,
      tags: [],
      clickUrl: launch,
    });
  }

  if (parsed.data.surveys.length > 0 && surveys.length === 0 && invalidCount === parsed.data.surveys.length) {
    return { ok: false, error: "malformed" };
  }
  return { ok: true, surveys };
}

function launchUrl(hrefNew: string | undefined, href: string | undefined): string | null {
  if (hrefNew && isCpxLaunchUrl(hrefNew)) return hrefNew;
  if (href && isCpxLaunchUrl(href)) return href;
  return null;
}

function payoutText(value: string | number): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function minutes(value: string | number | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function rating(value: string | number | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5) return null;
  return parsed;
}
