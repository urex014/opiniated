import { absoluteUrl, siteOrigin } from "@/lib/site/origin";

const description = "Share your views through online surveys and earn rewards for the time you spend participating.";

export function siteJsonLd() {
  const origin = siteOrigin();
  const url = absoluteUrl("/");
  const organizationId = `${origin}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Opiniated",
        url,
        logo: absoluteUrl("/icons/icon-512.png"),
        description,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "Opiniated",
        url,
        description,
        publisher: { "@id": organizationId },
      },
    ],
  };
}
