import "server-only";
import { headers } from "next/headers";
import { readEnv } from "@/lib/env";
import { clientIpFromHeaders } from "@/lib/security/ip";
import { fetchActiveSurveys } from "@/lib/survey-providers/service";
import type { SurveyFetchResult } from "@/lib/survey-providers/types";

export async function loadSurveysForUser(userId: string): Promise<SurveyFetchResult> {
  const env = readEnv();
  const headerList = await headers();
  return fetchActiveSurveys({
    env,
    userId,
    clientIp: clientIpFromHeaders(headerList),
    userAgent: headerList.get("user-agent"),
  });
}
