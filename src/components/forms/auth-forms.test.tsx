import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegisterForm } from "@/components/forms/auth-forms";
import { PasswordField } from "@/components/ui/password-field";

describe("registration form", () => {
  it("renders confirm password and independent show controls", () => {
    const html = renderToStaticMarkup(<RegisterForm siteKey={null} />);
    expect(html).toContain("Full name");
    expect(html).toContain("Confirm password");
    expect(html).toContain("Create account");
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirm"');
    expect(html).toContain("Show password");
    expect(html).toContain("Show confirm password");
    expect(html).toContain("I have read and agree to the");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(html).not.toContain("checked");
    expect(html).not.toContain("Passwords do not match.");
  });

  it("starts both password fields hidden and labels each toggle", () => {
    const password = renderToStaticMarkup(
      <PasswordField label="Password" name="password" autoComplete="new-password" visibilityLabel="password" />,
    );
    const confirm = renderToStaticMarkup(
      <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" visibilityLabel="confirm password" />,
    );
    expect(password).toContain('type="password"');
    expect(password).toContain("Show password");
    expect(password).not.toContain("Show confirm password");
    expect(confirm).toContain('type="password"');
    expect(confirm).toContain("Show confirm password");
    expect(confirm).not.toContain(">Show password<");
  });
});