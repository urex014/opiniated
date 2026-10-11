import { describe, expect, it } from "vitest";
import { normalizeSurveyPayload } from "@/lib/bitlabs/normalize";

const click = "https://api.bitlabs.ai/v2/client/clicks?s=survey-session&i=impression";

function payload(surveys: unknown[], restriction?: unknown) {
  return { data: { surveys, restriction_reason: restriction } };
}

describe("survey normalization", () => {
  it("normalizes a provider survey and drops the raw payload shape", () => {
    const result = normalizeSurveyPayload(
      payload([
        {
          id: "survey-1",
          type: "survey",
          click_url: click,
          value: "75",
          loi: 8.2,
          rating: 4,
          country: "US",
          category: { name: "Shopping habits" },
          tags: ["pii", "unknown"],
        },
      ]),
      "PTS",
      1,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.surveys[0]).toMatchObject({
      id: "survey-1",
      title: "Shopping habits",
      rewardUnits: 75,
      rewardLabel: "75 PTS",
      durationMinutes: 8.2,
      tags: ["pii"],
    });
    expect(result.surveys[0]?.clickUrl).toBe(click);
  });

  it("returns an empty list without treating it as an error", () => {
    const result = normalizeSurveyPayload(payload([]), "PTS", 1);
    expect(result).toEqual({ ok: true, surveys: [], restriction: null });
  });

  it("reports a provider restriction instead of inventing surveys", () => {
    const result = normalizeSurveyPayload(payload([], { using_vpn: true }), "PTS", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.restriction?.code).toBe("using_vpn");
    expect(result.surveys).toHaveLength(0);
  });

  it("rejects a malformed body", () => {
    expect(normalizeSurveyPayload({ nope: true }, "PTS", 1)).toEqual({ ok: false, error: "malformed" });
  });

  it("rejects surveys whose launch URL is not the BitLabs click endpoint", () => {
    const result = normalizeSurveyPayload(
      payload([{ id: "x", click_url: "https://evil.example/phish", value: "10" }]),
      "PTS",
      1,
    );
    expect(result).toEqual({ ok: false, error: "malformed" });
  });

  it("keeps a survey when optional metadata is missing", () => {
    const result = normalizeSurveyPayload(payload([{ id: "plain", click_url: click, value: "10" }]), "PTS", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.surveys[0]).toMatchObject({
      title: "Survey",
      durationMinutes: null,
      rating: null,
      category: null,
    });
  });
});
