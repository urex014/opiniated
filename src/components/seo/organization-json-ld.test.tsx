import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import { organizationJsonLd } from "@/lib/site/organization";

describe("organization markup", () => {
  it("names Opiniated, its site, and its logo", () => {
    expect(organizationJsonLd["@type"]).toBe("Organization");
    expect(organizationJsonLd.name).toBe("Opiniated");
    expect(organizationJsonLd.url).toBe("https://opiniated.vercel.app/");
    expect(organizationJsonLd.logo).toBe("https://opiniated.vercel.app/icons/icon-512.png");
    expect("sameAs" in organizationJsonLd).toBe(false);

    const html = renderToStaticMarkup(<OrganizationJsonLd />);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain("Opiniated");
    expect(html).toContain("https://opiniated.vercel.app/icons/icon-512.png");
  });
});
