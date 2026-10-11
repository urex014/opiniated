import { getCurrentUser } from "@/lib/auth/current-user";
import { toPublicSurveys } from "@/lib/bitlabs/normalize";
import { loadSurveysForUser } from "@/lib/surveys/load";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await loadSurveysForUser(user.id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.error === "not_configured" ? 503 : 502 });
  }

  return Response.json({
    surveys: toPublicSurveys(result.surveys),
    restriction: result.restriction,
  });
}
