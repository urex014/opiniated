import { organizationJsonLd } from "@/lib/site/organization";

export function OrganizationJsonLd() {
  const json = JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
