import "server-only";
import type { AppEnv } from "@/lib/env";
import { cpxProvider } from "@/lib/survey-providers/providers/cpx/adapter";
import { activeSurveyProvider, CPX_PROVIDER_ID } from "@/lib/survey-providers/registry";
import type { SurveyFetchResult } from "@/lib/survey-providers/types";

export async function fetchActiveSurveys(input: {
  env: AppEnv;
  userId: string;
  clientIp: string | null;
  userAgent: string | null;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  delayImpl?: (ms: number) => Promise<void>;
}): Promise<SurveyFetchResult> {
  const active = activeSurveyProvider(input.env);
  if (!active || active.id !== CPX_PROVIDER_ID || !input.env.cpxAppId || !input.env.cpxSecureHash) {
    return { ok: false, error: "not_configured" };
  }
  return cpxProvider.fetchSurveys({
    userId: input.userId,
    appId: input.env.cpxAppId,
    secureHash: input.env.cpxSecureHash,
    currencyCode: input.env.rewardCurrencyCode,
    minorUnitFactor: input.env.rewardMinorUnitFactor,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
    baseUrl: input.env.cpxApiBase,
    fetchImpl: input.fetchImpl,
    delayImpl: input.delayImpl,
  });
}
