import { getCurrentUser } from "@/lib/auth/current-user";
import { toPublicSurveys } from "@/lib/survey-providers/types";
import { tooManyRequests } from "@/lib/risk/http";
import { rateLimitStore } from "@/lib/risk/store";
import { loadSurveysForUser } from "@/lib/surveys/load";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const limit = await rateLimitStore().consume(`surveys:list:${user.id}`, 60, 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit);

  const result = await loadSurveysForUser(user.id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.error === "not_configured" ? 503 : 502 });
  }

  return Response.json({
    surveys: toPublicSurveys(result.surveys),
    restriction: result.restriction,
  });
}
