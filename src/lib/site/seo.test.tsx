import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/(marketing)/page";
import HelpPage from "@/app/(marketing)/help/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { absoluteUrl } from "@/lib/site/origin";
import { publicMetadata } from "@/lib/site/metadata";
import { publicPages } from "@/lib/site/public-pages";

const privatePaths = ["/dashboard", "/surveys", "/rewards", "/payouts", "/activity", "/account", "/admin", "/api/", "/login"];

describe("public crawl files", () => {
  it("lists only the public canonical URLs", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(publicPages.map((page) => absoluteUrl(page.path)));
    for (const path of privatePaths) {
      expect(urls.some((url) => url.includes(path))).toBe(false);
    }
    const privacy = sitemap().find((entry) => entry.url === absoluteUrl("/privacy"));
    expect(privacy?.lastModified).toBe("2026-10-12");
  });

  it("lets crawlers read marketing pages and skips private routes", () => {
    const file = robots();
    const rule = Array.isArray(file.rules) ? file.rules[0] : file.rules;
    expect(rule?.allow).toBe("/");
    expect(rule?.disallow).toEqual(expect.arrayContaining(privatePaths));
    expect(file.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });

  it("gives each public page its own title, description, and canonical path", () => {
    const descriptions = new Set<string>();
    for (const page of publicPages) {
      const metadata = publicMetadata(page.path);
      expect(metadata.title).toBe(page.title);
      expect(metadata.description).toBe(page.description);
      expect(metadata.alternates).toMatchObject({ canonical: page.path });
      descriptions.add(page.description);
    }
    expect(descriptions.size).toBe(publicPages.length);
  });
});

describe("public explanations", () => {
  it("states the payout rules on the homepage without an income promise", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("100 OPN equal $1.00");
    expect(html).toContain("Nigerian bank account");
    expect(html).toContain("24 hours");
    expect(html).toContain('href="/help"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain("guaranteed income");
  });

  it("answers screen-outs, email confirmation, and disputes on the help page", () => {
    const html = renderToStaticMarkup(<HelpPage />);
    expect(html).toContain("What happens if I do not qualify?");
    expect(html).toContain("Survey access is not blocked");
    expect(html).toContain("How do I dispute a balance?");
    expect(html).toContain('href="/contact"');
  });
});
