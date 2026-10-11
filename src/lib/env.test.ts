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
});
