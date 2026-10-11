import "server-only";
import { headers } from "next/headers";
import { fetchBitlabsSurveys } from "@/lib/bitlabs/client";
import type { SurveyFetchResult } from "@/lib/bitlabs/types";
import { readEnv } from "@/lib/env";
import { clientIpFromHeaders } from "@/lib/security/ip";

export async function loadSurveysForUser(userId: string): Promise<SurveyFetchResult> {
  const env = readEnv();
  if (!env.bitlabsApiToken) return { ok: false, error: "not_configured" };
  const headerList = await headers();
  return fetchBitlabsSurveys({
    userId,
    token: env.bitlabsApiToken,
    currencyCode: env.rewardCurrencyCode,
    minorUnitFactor: env.rewardMinorUnitFactor,
    clientIp: clientIpFromHeaders(headerList),
    userAgent: headerList.get("user-agent"),
  });
}
