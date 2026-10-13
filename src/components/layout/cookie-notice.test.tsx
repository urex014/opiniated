import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { acceptedCookie, CookieNotice, hasAcceptedCookies } from "@/components/layout/cookie-notice";

describe("cookie notice", () => {
  it("stays out of the server markup until the page has loaded", () => {
    expect(renderToStaticMarkup(<CookieNotice />)).toContain('data-cookie-notice="hidden"');
    expect(renderToStaticMarkup(<CookieNotice />)).not.toContain("Accept");
  });

  it("records acceptance for 180 days and recognizes that cookie", () => {
    expect(hasAcceptedCookies("")).toBe(false);
    expect(hasAcceptedCookies("opiniated_session=abc")).toBe(false);
    expect(hasAcceptedCookies("opiniated_cookie_notice=accepted")).toBe(true);
    expect(acceptedCookie(false)).toBe("opiniated_cookie_notice=accepted; Max-Age=15552000; Path=/; SameSite=Lax");
    expect(acceptedCookie(true)).toContain("; Secure");
  });
});
