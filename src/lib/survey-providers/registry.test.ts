import { describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env";
import { activeLaunchAllowed, listSurveyProviders } from "@/lib/survey-providers/registry";
import { fetchActiveSurveys } from "@/lib/survey-providers/service";

const click = "https://click.cpx-research.com/?k=session";

function configured(enabled: "true" | "false", extra: Record<string, string> = {}) {
  return readEnv({
    CPX_RESEARCH_APP_ID: "10",
    CPX_RESEARCH_SECURE_HASH: "app-secret",
    CPX_RESEARCH_ENABLED: enabled,
    ...extra,
  });
}

describe("survey provider registry", () => {
  it("registers only CPX Research and keeps it unavailable until it is configured and enabled", () => {
    const off = listSurveyProviders(readEnv({}));
    expect(off.map((provider) => provider.id)).toEqual(["cpx"]);
    expect(off[0]).toMatchObject({ displayName: "CPX Research", configured: false, enabled: false });

    const flagged = listSurveyProviders(readEnv({ CPX_RESEARCH_ENABLED: "true" }));
    expect(flagged[0]?.enabled).toBe(false);
    expect(flagged[0]?.configError).toMatch(/missing/);

    const ready = listSurveyProviders(configured("false"));
    expect(ready[0]).toMatchObject({ configured: true, enabled: false, configError: null });
    expect(listSurveyProviders(configured("true"))[0]?.enabled).toBe(true);
  });

  it("follows a CPX entry link only while that provider is enabled", () => {
    expect(activeLaunchAllowed(click, configured("true"))).toBe(true);
    expect(activeLaunchAllowed(click, configured("false"))).toBe(false);
    expect(activeLaunchAllowed("https://click.cpx-research.com/", configured("true"))).toBe(false);
    expect(activeLaunchAllowed("https://api.bitlabs.ai/v2/client/clicks?s=a&i=b", configured("true"))).toBe(false);
    expect(activeLaunchAllowed("http://click.cpx-research.com/?k=session", configured("true"))).toBe(false);
  });

  it("does not call CPX when the provider is disabled or missing credentials", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchActiveSurveys({
        env: configured("false"),
        userId: "user-1",
        clientIp: null,
        userAgent: null,
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: false, error: "not_configured" });
    await expect(
      fetchActiveSurveys({
        env: readEnv({ CPX_RESEARCH_ENABLED: "true" }),
        userId: "user-1",
        clientIp: null,
        userAgent: null,
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: false, error: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
