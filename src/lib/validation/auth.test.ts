import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

describe("authentication input", () => {
  it("rejects an invalid email and a weak password", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "password",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid registration and stores the email in lowercase", () => {
    const result = registerSchema.safeParse({
      name: "  Ada  ",
      email: "Ada@Example.com",
      password: "correct-horse-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.name).toBe("Ada");
    }
  });

  it("rejects a login with a missing password", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
  });
});
