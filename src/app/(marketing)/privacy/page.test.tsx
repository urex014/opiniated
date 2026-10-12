import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ContactPage from "@/app/(marketing)/contact/page";
import PrivacyPage from "@/app/(marketing)/privacy/page";
import TermsPage from "@/app/(marketing)/terms/page";

describe("public policy pages", () => {
  it("publishes the privacy policy with provider and contact language", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("Version 2026-10-12.2");
    expect(html).toContain("Paystack");
    expect(html).toContain("Resend");
    expect(html).toContain("TheoremReach is not enabled");
    expect(html).toContain("CPX Research");
    expect(html).toContain("opiniated_session");
    expect(html).toContain("Needs review");
    expect(html).toContain("sign-in");
    expect(html.includes("mailto:") || html.includes("NEXT_PUBLIC_SUPPORT_EMAIL")).toBe(true);
  });

  it("publishes the terms with reward and fraud rules", () => {
    const html = renderToStaticMarkup(<TermsPage />);
    expect(html).toContain("Terms of Service");
    expect(html).toContain("Version 2026-10-12.2");
    expect(html).toContain("100 OPN equal $1.00");
    expect(html).toContain("Paystack marks it paid only after the transfer succeeds");
    expect(html).toContain("One person, one account");
    expect(html).toContain("verified provider callback");
    expect(html).toContain("TheoremReach is not connected");
  });

  it("uses the same unpublished-contact warning on the contact page", () => {
    const html = renderToStaticMarkup(<ContactPage />);
    expect(html.includes("mailto:") || html.includes("NEXT_PUBLIC_SUPPORT_EMAIL")).toBe(true);
    expect(html).toContain("privacy requests");
  });
});
