import { siteJsonLd } from "@/lib/site/organization";

export function OrganizationJsonLd() {
  const json = JSON.stringify(siteJsonLd()).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
