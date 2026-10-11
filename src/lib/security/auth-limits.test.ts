import { afterEach, describe, expect, it } from "vitest";
import { allowAuthAttempt, AUTH_LIMITS } from "@/lib/security/auth-limits";
import { resetRateLimits } from "@/lib/security/rate-limit";

afterEach(() => {
  resetRateLimits();
});

describe("authentication rate limits", () => {
  it.each(Object.keys(AUTH_LIMITS) as Array<keyof typeof AUTH_LIMITS>)("stops %s after its limit", (kind) => {
    const policy = AUTH_LIMITS[kind];
    for (let attempt = 0; attempt < policy.limit; attempt += 1) {
      expect(allowAuthAttempt(kind, "203.0.113.9", "person@example.com")).toBe(true);
    }
    expect(allowAuthAttempt(kind, "203.0.113.9", "person@example.com")).toBe(false);
  });

  it("does not let one address consume another address's login attempts", () => {
    for (let attempt = 0; attempt < AUTH_LIMITS.login.limit; attempt += 1) {
      expect(allowAuthAttempt("login", "203.0.113.9", "one@example.com")).toBe(true);
    }
    expect(allowAuthAttempt("login", "203.0.113.9", "two@example.com")).toBe(true);
  });
});
