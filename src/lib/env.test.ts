import { describe, expect, it } from "vitest";
import { readEnv } from "@/lib/env";

describe("Resend configuration", () => {
  it("accepts a display name and a bare address", () => {
    expect(
      readEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Opiniated <hello@example.com>" }).email,
    ).toEqual({ apiKey: "re_test", from: "Opiniated <hello@example.com>" });
    expect(readEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: "hello@example.com" }).email).toEqual({
      apiKey: "re_test",
      from: "hello@example.com",
    });
  });

  it("accepts only the hostnames configured for this deployment", () => {
    expect(readEnv({ TURNSTILE_HOSTNAMES: " localhost , Example.COM " }).turnstileHostnames).toEqual([
      "localhost",
      "example.com",
    ]);
    expect(readEnv({}).turnstileHostnames).toEqual([]);
  });

  it("stays unset unless both the key and a valid from address are present", () => {
    expect(readEnv({ RESEND_API_KEY: "re_test" }).email).toBeNull();
    expect(readEnv({ EMAIL_FROM: "hello@example.com" }).email).toBeNull();
    expect(readEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: "not-an-email" }).email).toBeNull();
    expect(readEnv({}).email).toBeNull();
  });

  it("keeps Paystack transfers off unless they are explicitly enabled", () => {
    expect(readEnv({}).paystackTransfersEnabled).toBe(false);
    expect(readEnv({}).paystackLiveConfirmed).toBe(false);
    expect(readEnv({}).payoutKoboPerPoint).toBeNull();
    expect(readEnv({}).payoutMinKobo).toBe(10_000);
    expect(readEnv({ PAYSTACK_TRANSFERS_ENABLED: "true", PAYSTACK_SECRET_KEY: "sk_test_example" }).paystackTransfersEnabled).toBe(true);
    expect(readEnv({ ADMIN_EMAILS: " Admin@Example.com, not-an-email " }).adminEmails).toEqual(["admin@example.com"]);
  });

  it("uses one kobo per unit when the ledger is already NGN kobo", () => {
    expect(readEnv({ REWARD_CURRENCY_CODE: "NGN", REWARD_MINOR_UNIT_FACTOR: "100" }).payoutKoboPerPoint).toBe(1);
  });

  it("prices one OPN at the whole-naira dollar rate", () => {
    expect(readEnv({ REWARD_CURRENCY_CODE: "OPN" }).payoutKoboPerPoint).toBeNull();
    expect(readEnv({ REWARD_CURRENCY_CODE: "OPN", PAYOUT_NGN_PER_USD: "1500" }).payoutKoboPerPoint).toBe(1500);
    expect(() => readEnv({ REWARD_CURRENCY_CODE: "OPN", PAYOUT_NGN_PER_USD: "1500", PAYOUT_KOBO_PER_POINT: "1400" })).toThrow(
      /PAYOUT_KOBO_PER_POINT/,
    );
  });
});
