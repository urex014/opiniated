import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isAllowedSurveyClickUrl } from "@/lib/security/click-url";
import { rateLimit } from "@/lib/security/rate-limit";
import { loadSurveysForUser } from "@/lib/surveys/load";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return redirectTo(request, "/surveys?error=load");
    }
    if (originHost !== new URL(request.url).host) {
      return redirectTo(request, "/surveys?error=load");
    }
  }

  if (!rateLimit(`start:${user.id}`, 30, 60 * 1000)) {
    return redirectTo(request, "/surveys?error=rate");
  }

  const form = await request.formData();
  const surveyId = String(form.get("surveyId") ?? "");
  if (!surveyId || surveyId.length > 128) {
    return redirectTo(request, "/surveys?error=missing");
  }

  const result = await loadSurveysForUser(user.id);
  if (!result.ok) return redirectTo(request, "/surveys?error=load");
  const survey = result.surveys.find((item) => item.id === surveyId);
  if (!survey || !isAllowedSurveyClickUrl(survey.clickUrl)) {
    return redirectTo(request, "/surveys?error=missing");
  }

  await prisma.surveyActivity.create({
    data: {
      userId: user.id,
      provider: "bitlabs",
      surveyId: survey.id,
      status: "STARTED",
      startedAt: new Date(),
    },
  });

  return NextResponse.redirect(survey.clickUrl, 303);
}

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}
