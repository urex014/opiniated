import { describe, expect, it, vi } from "vitest";
import { fetchBitlabsSurveys } from "@/lib/bitlabs/client";

const click = "https://api.bitlabs.ai/v2/client/clicks?s=abc&i=def";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const baseInput = {
  userId: "user-1",
  token: "token",
  currencyCode: "PTS",
  minorUnitFactor: 1,
};

describe("BitLabs survey client", () => {
  it("sends the token and user id on the server request", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Api-Token")).toBe("token");
      expect(headers.get("X-User-Id")).toBe("user-1");
      return jsonResponse({ data: { surveys: [{ id: "s1", click_url: click, value: "40", loi: 5 }] } });
    });
    const result = await fetchBitlabsSurveys({ ...baseInput, fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.surveys).toHaveLength(1);
  });

  it("returns an empty list when the provider has no surveys", async () => {
    const result = await fetchBitlabsSurveys({
      ...baseInput,
      fetchImpl: async () => jsonResponse({ data: { surveys: [] } }),
    });
    expect(result).toEqual({ ok: true, surveys: [], restriction: null });
  });

  it("maps unauthorized, rate limits, timeouts, and malformed JSON", async () => {
    await expect(
      fetchBitlabsSurveys({ ...baseInput, fetchImpl: async () => new Response("", { status: 401 }) }),
    ).resolves.toEqual({ ok: false, error: "unauthorized" });

    const limited = vi.fn(async () => new Response("", { status: 429 }));
    await expect(fetchBitlabsSurveys({ ...baseInput, fetchImpl: limited })).resolves.toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(limited).toHaveBeenCalledTimes(2);

    await expect(
      fetchBitlabsSurveys({
        ...baseInput,
        fetchImpl: async () => {
          throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
        },
      }),
    ).resolves.toEqual({ ok: false, error: "timeout" });

    await expect(
      fetchBitlabsSurveys({ ...baseInput, fetchImpl: async () => new Response("nope", { status: 200 }) }),
    ).resolves.toEqual({ ok: false, error: "malformed" });
  });

  it("does not call the provider when the token is missing", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchBitlabsSurveys({ ...baseInput, token: "", fetchImpl })).resolves.toEqual({
      ok: false,
      error: "not_configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
