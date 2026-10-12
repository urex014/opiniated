import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { fetchCpxSurveys } from "@/lib/survey-providers/providers/cpx/client";

const secret = "app-secret-value";
const click = "https://click.cpx-research.com/?k=abc";
const hrefNew = "https://click.cpx-research.com/?k=new";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function survey(overrides: Record<string, unknown> = {}) {
  return {
    id: "484727",
    loi: "6",
    payout: 0.4,
    conversion_rate: "89.00",
    score: "14.9817",
    statistics_rating_count: "0",
    statistics_rating_avg: "0",
    type: "need_qualification",
    top: 0,
    details: 0,
    payout_publisher_usd: "0.81",
    href: click,
    ...overrides,
  };
}

const baseInput = {
  userId: "507f1f77bcf86cd799439011",
  appId: "10",
  secureHash: secret,
  currencyCode: "OPN",
  minorUnitFactor: 100,
  delayImpl: async () => undefined,
};

describe("CPX survey client", () => {
  it("requests surveys for that user only and keeps the secure hash off the URL", async () => {
    let seen = "";
    const result = await fetchCpxSurveys({
      ...baseInput,
      clientIp: "203.0.113.8",
      userAgent: "Opiniated test",
      fetchImpl: async (url) => {
        seen = String(url);
        return jsonResponse({ status: "success", surveys: [survey()] });
      },
    });
    const parsed = new URL(seen);
    const expected = createHash("md5").update(`${baseInput.userId}-${secret}`).digest("hex");
    expect(parsed.origin + parsed.pathname).toBe("https://live-api.cpx-research.com/api/get-surveys.php");
    expect(parsed.searchParams.get("app_id")).toBe("10");
    expect(parsed.searchParams.get("ext_user_id")).toBe(baseInput.userId);
    expect(parsed.searchParams.get("ext_user_id")).not.toBe("another-user");
    expect(parsed.searchParams.get("output_method")).toBe("api");
    expect(parsed.searchParams.get("ip_user")).toBe("203.0.113.8");
    expect(parsed.searchParams.get("user_agent")).toBe("Opiniated test");
    expect(parsed.searchParams.get("secure_hash")).toBe(expected);
    expect(seen).not.toContain(secret);
    expect(parsed.searchParams.get("email")).toBeNull();
    expect(parsed.searchParams.has("birthday_year")).toBe(false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providerId).toBe("cpx");
    expect(result.surveys[0]).toMatchObject({
      id: "484727",
      title: "Survey",
      rewardUnits: 40,
      durationMinutes: 6,
      rating: null,
      clickUrl: click,
      tags: [],
    });
    expect(JSON.stringify(result.surveys[0])).not.toContain("0.81");
    expect(JSON.stringify(result.surveys[0])).not.toContain("89.00");
  });

  it("prefers href_new and keeps a zero rating empty", async () => {
    const result = await fetchCpxSurveys({
      ...baseInput,
      fetchImpl: async () =>
        jsonResponse({
          status: "success",
          surveys: [survey({ href_new: hrefNew, statistics_rating_avg: "4" })],
        }),
    });
    expect(result.ok && result.surveys[0]?.clickUrl).toBe(hrefNew);
    expect(result.ok && result.surveys[0]?.rating).toBe(4);
  });

  it("omits ip_user when the client IP is not trusted", async () => {
    let seen = "";
    await fetchCpxSurveys({
      ...baseInput,
      clientIp: null,
      fetchImpl: async (url) => {
        seen = String(url);
        return jsonResponse({ status: "success", surveys: [] });
      },
    });
    expect(new URL(seen).searchParams.has("ip_user")).toBe(false);
  });

  it("maps unauthorized, rate limits, timeouts, outages, and unusable payloads", async () => {
    await expect(fetchCpxSurveys({ ...baseInput, fetchImpl: async () => new Response("", { status: 401 }) })).resolves.toEqual({
      ok: false,
      error: "unauthorized",
    });
    const limited = vi.fn(async () => new Response("", { status: 429 }));
    await expect(fetchCpxSurveys({ ...baseInput, fetchImpl: limited })).resolves.toEqual({ ok: false, error: "rate_limited" });
    expect(limited).toHaveBeenCalledTimes(2);
    await expect(
      fetchCpxSurveys({
        ...baseInput,
        fetchImpl: async () => {
          throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
        },
      }),
    ).resolves.toEqual({ ok: false, error: "timeout" });
    await expect(
      fetchCpxSurveys({
        ...baseInput,
        fetchImpl: async () => {
          throw new Error("offline");
        },
      }),
    ).resolves.toEqual({ ok: false, error: "unavailable" });
    await expect(
      fetchCpxSurveys({ ...baseInput, fetchImpl: async () => jsonResponse({ status: "error" }) }),
    ).resolves.toEqual({ ok: false, error: "unavailable" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      fetchCpxSurveys({ ...baseInput, fetchImpl: async () => jsonResponse({ status: "success" }) }),
    ).resolves.toEqual({ ok: false, error: "malformed" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(secret);
    spy.mockRestore();
  });

  it("does not call CPX when credentials are missing", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchCpxSurveys({ ...baseInput, secureHash: "", fetchImpl })).resolves.toEqual({
      ok: false,
      error: "not_configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
