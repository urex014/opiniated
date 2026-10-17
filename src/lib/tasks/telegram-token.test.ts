import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  readEnv: vi.fn(() => ({
    authSecret: "test-auth-secret-key-at-least-32-chars-long!",
  })),
}));

import {
  generateTelegramVerificationPayload,
  verifyTelegramVerificationPayload,
} from "./telegram-token";

describe("telegram token generation and verification", () => {
  it("generates and verifies a valid payload for a user", () => {
    const userId = "65f1234567890abcdef12345";
    const payload = generateTelegramVerificationPayload(userId);

    expect(payload).toBeDefined();
    expect(payload.length).toBeLessThanOrEqual(64); // within Telegram start param limit

    const result = verifyTelegramVerificationPayload(payload);
    expect(result).toEqual({ ok: true, userId });
  });

  it("rejects a payload with a tampered signature", () => {
    const userId = "65f1234567890abcdef12345";
    const payload = generateTelegramVerificationPayload(userId);
    const parts = payload.split("_");
    const tampered = `${parts[0]}_${parts[1]}_0123456789abcdef`;

    const result = verifyTelegramVerificationPayload(tampered);
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects an expired payload", () => {
    const userId = "65f1234567890abcdef12345";
    const payload = generateTelegramVerificationPayload(userId);

    // Simulate verification 48 hours later (expiry is 24 hours)
    const futureTime = Math.floor(Date.now() / 1000) + 172800;
    const result = verifyTelegramVerificationPayload(payload, futureTime);

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects malformed payloads", () => {
    expect(verifyTelegramVerificationPayload("")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(verifyTelegramVerificationPayload("foo_bar")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(verifyTelegramVerificationPayload("a_b_c_d")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });
});
