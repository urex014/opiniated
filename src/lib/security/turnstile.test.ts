import { describe, expect, it } from "vitest";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const configured = { secret: "turnstile-secret", hostnames: ["localhost"], action: "signup" };

describe("Turnstile verification", () => {
  it("fails closed when the secret or hostname allowlist is missing", async () => {
    const noSecret = await verifyTurnstileToken("token", "203.0.113.8", {
      ...configured,
      secret: null,
      fetchImpl: fetch,
    });
    const noHost = await verifyTurnstileToken("token", "203.0.113.8", {
      ...configured,
      hostnames: [],
      fetchImpl: fetch,
    });
    expect(noSecret).toEqual({ ok: false, reason: "not_configured" });
    expect(noHost).toEqual({ ok: false, reason: "not_configured" });
  });

  it("rejects a missing token without calling Cloudflare", async () => {
    let called = false;
    const result = await verifyTurnstileToken("  ", "203.0.113.8", {
      ...configured,
      secret: "secret",
      fetchImpl: async () => {
        called = true;
        return jsonResponse({ success: true });
      },
    });
    expect(result).toEqual({ ok: false, reason: "missing" });
    expect(called).toBe(false);
  });

  it("accepts a token Cloudflare marks successful for this action and hostname", async () => {
    const result = await verifyTurnstileToken("fresh-token", "203.0.113.8", {
      ...configured,
      fetchImpl: async (_url, init) => {
        const body = new URLSearchParams(String(init?.body ?? ""));
        expect(body.get("secret")).toBe("turnstile-secret");
        expect(body.get("response")).toBe("fresh-token");
        expect(body.get("remoteip")).toBe("203.0.113.8");
        return jsonResponse({ success: true, action: "signup", hostname: "localhost" });
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a token for a different action or hostname", async () => {
    const wrongAction = await verifyTurnstileToken("fresh-token", null, {
      ...configured,
      fetchImpl: async () => jsonResponse({ success: true, action: "login", hostname: "localhost" }),
    });
    const wrongHost = await verifyTurnstileToken("fresh-token", null, {
      ...configured,
      fetchImpl: async () => jsonResponse({ success: true, action: "signup", hostname: "evil.example" }),
    });
    expect(wrongAction).toEqual({ ok: false, reason: "invalid" });
    expect(wrongHost).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an invalid, expired, or reused token", async () => {
    const result = await verifyTurnstileToken("used-token", null, {
      ...configured,
      fetchImpl: async () => jsonResponse({ success: false, "error-codes": ["timeout-or-duplicate"] }),
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not treat a provider error as success", async () => {
    const result = await verifyTurnstileToken("fresh-token", null, {
      ...configured,
      fetchImpl: async () => jsonResponse({ success: false }, 500),
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
