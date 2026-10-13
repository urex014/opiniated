import type { MetadataRoute } from "next";
import { POLICY_VERSIONS } from "@/lib/legal/versions";
import { absoluteUrl } from "@/lib/site/origin";
import { publicPages } from "@/lib/site/public-pages";

const policyReviewed = POLICY_VERSIONS.privacy.slice(0, 10);

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    ...((page.path === "/privacy" || page.path === "/terms") && policyReviewed.length === 10
      ? { lastModified: policyReviewed }
      : {}),
  }));
}
