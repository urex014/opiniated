import { cpxApiSecureHash } from "@/lib/survey-providers/providers/cpx/hash";
import { normalizeCpxSurveys } from "@/lib/survey-providers/providers/cpx/normalize";
import { CPX_PROVIDER_ID } from "@/lib/survey-providers/registry";
import type { SurveyFetchResult } from "@/lib/survey-providers/types";

const DEFAULT_BASE = "https://live-api.cpx-research.com";
const TIMEOUT_MS = 30_000;

export type FetchCpxSurveysInput = {
  userId: string;
  appId: string;
  secureHash: string;
  currencyCode: string;
  minorUnitFactor: number;
  clientIp?: string | null;
  userAgent?: string | null;
  baseUrl?: string;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  delayImpl?: (ms: number) => Promise<void>;
};

export async function fetchCpxSurveys(input: FetchCpxSurveysInput): Promise<SurveyFetchResult> {
  if (!input.appId || !input.secureHash) return { ok: false, error: "not_configured" };

  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await requestWithRetry(fetchImpl, surveyUrl(input), input.delayImpl);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "unavailable" };
  }

  if (response.status === 401 || response.status === 403) return { ok: false, error: "unauthorized" };
  if (response.status === 429) return { ok: false, error: "rate_limited" };
  if (!response.ok) return { ok: false, error: "unavailable" };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!isSuccess(payload)) return { ok: false, error: "unavailable" };

  const normalized = normalizeCpxSurveys(payload, input.currencyCode, input.minorUnitFactor);
  if (!normalized.ok) {
    console.error("CPX survey payload could not be normalized", { status: response.status });
    return normalized;
  }
  return { ok: true, providerId: CPX_PROVIDER_ID, surveys: normalized.surveys, restriction: null };
}

function surveyUrl(input: FetchCpxSurveysInput): URL {
  const url = new URL("/api/get-surveys.php", input.baseUrl ?? DEFAULT_BASE);
  url.searchParams.set("app_id", input.appId);
  url.searchParams.set("ext_user_id", input.userId);
  url.searchParams.set("output_method", "api");
  url.searchParams.set("limit", "12");
  if (input.clientIp) url.searchParams.set("ip_user", input.clientIp);
  if (input.userAgent) url.searchParams.set("user_agent", input.userAgent.slice(0, 512));
  url.searchParams.set("secure_hash", cpxApiSecureHash(input.userId, input.secureHash));
  return url;
}

function isSuccess(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && "status" in payload && payload.status === "success");
}

async function requestWithRetry(
  fetchImpl: NonNullable<FetchCpxSurveysInput["fetchImpl"]>,
  url: URL,
  delayImpl: FetchCpxSurveysInput["delayImpl"],
): Promise<Response> {
  const attempt = () =>
    fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  const first = await attempt();
  if (first.status !== 429 && first.status !== 503) return first;
  await (delayImpl ?? delay)(750);
  return attempt();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
