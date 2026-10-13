import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import { siteJsonLd } from "@/lib/site/organization";
import { absoluteUrl } from "@/lib/site/origin";

describe("organization markup", () => {
  it("names Opiniated, its site, and its logo without invented profiles or ratings", () => {
    const graph = siteJsonLd()["@graph"];
    const organization = graph.find((node) => node["@type"] === "Organization");
    const website = graph.find((node) => node["@type"] === "WebSite");
    expect(organization).toMatchObject({
      name: "Opiniated",
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icons/icon-512.png"),
    });
    expect(website).toMatchObject({ name: "Opiniated", url: absoluteUrl("/") });
    expect(JSON.stringify(graph)).not.toContain("aggregateRating");
    expect(JSON.stringify(graph)).not.toContain("sameAs");

    const html = renderToStaticMarkup(<OrganizationJsonLd />);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain("Opiniated");
    expect(html).toContain(absoluteUrl("/icons/icon-512.png"));
  });
});
