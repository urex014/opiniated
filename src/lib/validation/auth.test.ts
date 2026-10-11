import { describe, expect, it } from "vitest";
import { confirmPasswordMessage, loginSchema, registerFormValues, registerSchema, registrationIdentity } from "@/lib/validation/auth";

const valid = {
  name: "Ada",
  email: "ada@example.com",
  password: "correct-horse-1",
  confirm: "correct-horse-1",
  acceptPrivacy: true,
  acceptTerms: true,
};

describe("authentication input", () => {
  it("rejects an invalid email and a weak password", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "password",
      confirm: "password",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid registration and stores the email in lowercase", () => {
    const result = registerSchema.safeParse({
      name: "  Ada  ",
      email: "Ada@Example.com",
      password: "correct-horse-1",
      confirm: "correct-horse-1",
      acceptPrivacy: true,
      acceptTerms: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.name).toBe("Ada");
    }
  });

  it("rejects a mismatched confirmation", () => {
    const result = registerSchema.safeParse({ ...valid, confirm: "correct-horse-2" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirm).toContain("Passwords do not match.");
    }
  });

  it("rejects an empty confirmation", () => {
    const result = registerSchema.safeParse({ ...valid, confirm: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirm).toContain("Confirm your password.");
    }
  });

  it("keeps the confirmation value out of the stored account fields", () => {
    const parsed = registerSchema.parse(valid);
    const identity = registrationIdentity(parsed);
    expect(identity).toEqual({
      email: "ada@example.com",
      name: "Ada",
      password: "correct-horse-1",
    });
    expect(identity).not.toHaveProperty("confirm");
    expect(identity).not.toHaveProperty("acceptPrivacy");
    expect(identity).not.toHaveProperty("acceptTerms");
  });

  it("blocks registration when either policy checkbox is missing", () => {
    const privacy = registerSchema.safeParse({ ...valid, acceptPrivacy: false });
    const terms = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(privacy.success).toBe(false);
    expect(terms.success).toBe(false);
    if (!privacy.success) {
      expect(privacy.error.flatten().fieldErrors.acceptPrivacy).toContain("Read and agree to the Privacy Policy.");
    }
    if (!terms.success) {
      expect(terms.error.flatten().fieldErrors.acceptTerms).toContain("Read and agree to the Terms of Service.");
    }
  });

  it("treats an unchecked box as not accepted", () => {
    const form = new FormData();
    form.set("name", "Ada");
    form.set("email", "ada@example.com");
    form.set("password", "correct-horse-1");
    form.set("confirm", "correct-horse-1");
    form.set("acceptPrivacy", "on");
    const parsed = registerSchema.safeParse(registerFormValues(form));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.acceptTerms).toContain("Read and agree to the Terms of Service.");
    }
  });

  it("hides a mismatch until both fields have been touched", () => {
    expect(
      confirmPasswordMessage({
        password: "correct-horse-1",
        confirm: "other",
        passwordTouched: true,
        confirmTouched: false,
        submitted: false,
      }),
    ).toBeUndefined();
  });

  it("shows a mismatch after both fields have been touched and clears it when they match", () => {
    const touched = { passwordTouched: true, confirmTouched: true, submitted: false };
    expect(confirmPasswordMessage({ password: "correct-horse-1", confirm: "other", ...touched })).toBe("Passwords do not match.");
    expect(confirmPasswordMessage({ password: "correct-horse-1", confirm: "correct-horse-1", ...touched })).toBeUndefined();
  });

  it("requires confirmation when the form is submitted empty", () => {
    expect(
      confirmPasswordMessage({
        password: "correct-horse-1",
        confirm: "",
        passwordTouched: false,
        confirmTouched: false,
        submitted: true,
      }),
    ).toBe("Confirm your password.");
  });

  it("rejects a login with a missing password", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
  });
});
