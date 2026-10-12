import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { isAdminEmail } from "@/lib/payouts/access";
import { retentionDate, RISK_EVENT_RETENTION_DAYS } from "@/lib/risk/config";
import { decideRisk, riskLog } from "@/lib/risk/decide";
import { bankFingerprint, fingerprint, normalizeEmail } from "@/lib/risk/fingerprint";
import { tooManyRequests } from "@/lib/risk/http";
import { clientIp, normalizeIp, trustProxyEnabled } from "@/lib/risk/ip-address";
import { memoryRateLimitStore, resetRateLimits } from "@/lib/risk/rate-limit";
import { lookupIpReputation } from "@/lib/risk/reputation";
import { reviewDecision } from "@/lib/risk/review-decision";
import { signalsFromFacts } from "@/lib/risk/signals";

const now = new Date("2026-10-12T12:00:00.000Z");
const key = "test-fingerprint-key-at-least-32-chars";

function facts(overrides: Partial<Parameters<typeof signalsFromFacts>[0]> = {}) {
  return signalsFromFacts({
    sharedIp: false,
    emailAlias: false,
    recipientReused: false,
    completionVelocity: false,
    surveyVelocity: false,
    reputation: "unknown",
    adminBlock: false,
    rateLimited: false,
    ...overrides,
  });
}

afterEach(() => {
  resetRateLimits();
});

describe("trusted client addresses", () => {
  it("ignores forwarding headers unless the proxy is trusted", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.8, 10.0.0.1", "x-real-ip": "203.0.113.9" });
    expect(trustProxyEnabled({ TRUST_PROXY_HEADERS: "false", VERCEL: "1" })).toBe(false);
    expect(trustProxyEnabled({ TRUST_PROXY_HEADERS: "true" })).toBe(true);
    expect(trustProxyEnabled({ VERCEL: "1" })).toBe(true);
    expect(trustProxyEnabled({})).toBe(false);
    expect(clientIp(headers, false)).toBeNull();
    expect(clientIp(headers, true)).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.4, 10.0.0.8" }), true)).toBe("198.51.100.4");
  });

  it("normalizes IPv4, IPv4-mapped IPv6, and compressed IPv6", () => {
    expect(normalizeIp("203.0.113.9")).toBe("203.0.113.9");
    expect(normalizeIp("192.000.2.1")).toBeNull();
    expect(normalizeIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(normalizeIp("[::FFFF:203.0.113.9]")).toBe("203.0.113.9");
    expect(normalizeIp("2001:0DB8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
    expect(normalizeIp("not an ip")).toBeNull();
    expect(normalizeIp("fe80::1%eth0")).toBeNull();
  });
});

describe("rate limits", () => {
  it("stops the next request in the same window and allows the next window", async () => {
    const first = await memoryRateLimitStore.consume("login:203.0.113.9", 2, 1_000, 5_000);
    const second = await memoryRateLimitStore.consume("login:203.0.113.9", 2, 1_000, 5_100);
    const blocked = await memoryRateLimitStore.consume("login:203.0.113.9", 2, 1_000, 5_200);
    const later = await memoryRateLimitStore.consume("login:203.0.113.9", 2, 1_000, 6_000);
    expect(first.allowed && second.allowed && later.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    const response = tooManyRequests(blocked);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe(String(blocked.retryAfterSeconds));
    expect(await response.text()).toBe("Too many requests. Wait and try again.");
  });

  it("counts concurrent consumes without sharing another key's bucket", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => memoryRateLimitStore.consume("survey:start:user", 3, 60_000, 1_000)));
    const other = await memoryRateLimitStore.consume("survey:start:other", 3, 60_000, 1_000);
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(other.allowed).toBe(true);
  });
});

describe("duplicate-account signals", () => {
  it("matches a normalized inbox with a keyed fingerprint", () => {
    expect(normalizeEmail(" Jane.Doe+news@Gmail.com ")).toBe("janedoe@gmail.com");
    expect(normalizeEmail("jane.doe@googlemail.com")).toBe("janedoe@gmail.com");
    const digest = fingerprint(normalizeEmail("jane.doe+news@gmail.com"), key);
    expect(digest).toBe(fingerprint("janedoe@gmail.com", key));
    expect(digest).not.toBe(createHash("sha256").update("janedoe@gmail.com").digest("hex"));
    expect(digest).not.toBe(fingerprint("janedoe@gmail.com", `${key}-other`));
    expect(bankFingerprint({ bankCode: "058", accountLast4: "6789", accountName: " Ada  Lovelace " })).toBe("058:6789:ada lovelace");
  });

  it("reviews a reused inbox or payout account and does not ban a shared network", () => {
    const shared = decideRisk(facts({ sharedIp: true, reputation: "unknown" }), "shared", now);
    const alias = decideRisk(facts({ emailAlias: true }), "alias", now);
    const bank = decideRisk(facts({ recipientReused: true }), "bank", now);
    expect(shared).toMatchObject({ action: "ALLOW", level: "LOW", score: 5 });
    expect(alias.action).toBe("REVIEW");
    expect(alias.action).not.toBe("BLOCK");
    expect(bank).toMatchObject({ action: "REVIEW", signals: ["payout_recipient_reused"] });
  });
});

describe("risk decisions", () => {
  it("uses the configured bands and blocks only on an explicit admin rule", () => {
    expect(decideRisk(facts(), "none", now)).toMatchObject({ action: "ALLOW", score: 0, level: "LOW" });
    expect(decideRisk(facts({ surveyVelocity: true }), "survey", now).action).toBe("ALLOW");
    expect(decideRisk(facts({ completionVelocity: true }), "complete", now).action).toBe("REVIEW");
    expect(decideRisk(facts({ reputation: "malicious" }), "rep", now)).toMatchObject({ action: "REVIEW", level: "MEDIUM" });
    expect(decideRisk(facts({ rateLimited: true }), "rate", now).action).toBe("RESTRICT");
    const crowded = decideRisk(
      facts({ sharedIp: true, emailAlias: true, recipientReused: true, completionVelocity: true, surveyVelocity: true, reputation: "malicious" }),
      "crowded",
      now,
    );
    expect(crowded.score).toBe(100);
    expect(crowded.level).toBe("CRITICAL");
    expect(crowded.action).toBe("REVIEW");
    expect(decideRisk(facts({ adminBlock: true }), "admin", now).action).toBe("BLOCK");
    const logged = JSON.parse(riskLog(crowded, "postback")) as Record<string, unknown>;
    expect(Object.keys(logged).sort()).toEqual(["action", "correlationId", "level", "score", "signals", "stage", "type"]);
    expect(JSON.stringify(logged)).not.toContain("203.0.113.9");
    expect(retentionDate(now, RISK_EVENT_RETENTION_DAYS).toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

describe("optional reputation and admin review", () => {
  it("fails open when the reputation endpoint is missing or slow", async () => {
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    expect(await lookupIpReputation("203.0.113.4", { url: null, timeoutMs: 50 })).toBe("unknown");
    expect(await lookupIpReputation("203.0.113.4", { url: "https://reputation.example/check", timeoutMs: 20, fetchImpl: hanging })).toBe("unknown");
    const down: typeof fetch = async () => new Response("nope", { status: 503 });
    expect(await lookupIpReputation("203.0.113.4", { url: "https://reputation.example/check", timeoutMs: 50, fetchImpl: down })).toBe("unknown");
    const malicious: typeof fetch = async () => Response.json({ malicious: true });
    expect(await lookupIpReputation("203.0.113.4", { url: "https://reputation.example/v1?token=hidden", timeoutMs: 50, fetchImpl: malicious })).toBe("malicious");
  });

  it("lets only an allow-listed administrator release, restrict, or escalate", () => {
    expect(isAdminEmail("Admin@Example.com", ["admin@example.com"])).toBe(true);
    expect(isAdminEmail("person@example.com", ["admin@example.com"])).toBe(false);
    expect(reviewDecision("release")).toEqual({ action: "release", status: "RELEASED", scope: "payout" });
    expect(reviewDecision("restrict")).toEqual({ action: "restrict", status: "RESTRICTED", scope: "survey" });
    expect(reviewDecision("escalate")).toEqual({ action: "escalate", status: "ESCALATED", scope: "account" });
    expect(reviewDecision("block")).toBeNull();
  });
});
