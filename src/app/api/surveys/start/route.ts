import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireCurrentConsent } from "@/lib/legal/access";
import { isAllowedSurveyClickUrl } from "@/lib/security/click-url";
import { clientIpFromHeaders } from "@/lib/security/ip";
import { SURVEY_VELOCITY_LIMIT } from "@/lib/risk/config";
import { assessAccount } from "@/lib/risk/account-check";
import { surveyRestricted } from "@/lib/risk/persist";
import { rateLimitStore } from "@/lib/risk/store";
import { loadSurveysForUser } from "@/lib/surveys/load";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", "/surveys");
    return NextResponse.redirect(url, 303);
  }
  await requireCurrentConsent(user.id, "/surveys");

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

  const ip = clientIpFromHeaders(request.headers);
  const [byUser, byIp] = await Promise.all([
    rateLimitStore().consume(`survey:start:${user.id}`, 30, 60 * 1000),
    ip ? rateLimitStore().consume(`survey:start-ip:${ip}`, 60, 60 * 1000) : Promise.resolve({ allowed: true, retryAfterSeconds: 1 }),
  ]);
  if (!byUser.allowed || !byIp.allowed) {
    return redirectTo(request, "/surveys?error=rate");
  }
  if (await surveyRestricted(user.id)) {
    return redirectTo(request, "/surveys?error=review");
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

  const since = new Date(Date.now() - 10 * 60 * 1000);
  const recentStarts = await prisma.surveyActivity.count({
    where: { userId: user.id, status: "STARTED", createdAt: { gte: since } },
  });
  await prisma.surveyActivity.create({
    data: {
      userId: user.id,
      provider: result.providerId,
      surveyId: survey.id,
      status: "STARTED",
      startedAt: new Date(),
    },
  });
  if (recentStarts >= SURVEY_VELOCITY_LIMIT) {
    await assessAccount({ stage: "survey_launch", userId: user.id, ip, surveyVelocity: true });
  }

  return NextResponse.redirect(survey.clickUrl, 303);
}

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}
