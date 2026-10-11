import { normalizeSurveyPayload } from "@/lib/bitlabs/normalize";
import type { SurveyFetchResult } from "@/lib/bitlabs/types";

const DEFAULT_BASE = "https://api.bitlabs.ai";
const TIMEOUT_MS = 10_000;

export type FetchSurveysInput = {
  userId: string;
  token: string;
  currencyCode: string;
  minorUnitFactor: number;
  clientIp?: string | null;
  userAgent?: string | null;
  baseUrl?: string;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export async function fetchBitlabsSurveys(input: FetchSurveysInput): Promise<SurveyFetchResult> {
  if (!input.token) return { ok: false, error: "not_configured" };

  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL("/v2/client/surveys", input.baseUrl ?? DEFAULT_BASE);
  url.searchParams.set("sdk", "CUSTOM");
  if (input.clientIp) url.searchParams.set("client_ip", input.clientIp);
  if (input.userAgent) url.searchParams.set("client_useragent", input.userAgent.slice(0, 512));

  let response: Response;
  try {
    response = await requestWithRetry(fetchImpl, url, input.token, input.userId);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, error: "timeout" };
    }
    if (error instanceof Error && error.name === "AbortError") {
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

  const normalized = normalizeSurveyPayload(payload, input.currencyCode, input.minorUnitFactor);
  if (!normalized.ok && normalized.error === "malformed") {
    console.error("BitLabs survey payload could not be normalized", {
      status: response.status,
    });
  }
  return normalized;
}

async function requestWithRetry(
  fetchImpl: typeof fetch,
  url: URL,
  token: string,
  userId: string,
): Promise<Response> {
  const attempt = () =>
    fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Api-Token": token,
        "X-User-Id": userId,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  const first = await attempt();
  if (first.status !== 429 && first.status !== 503) return first;
  await delay(750);
  return attempt();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
