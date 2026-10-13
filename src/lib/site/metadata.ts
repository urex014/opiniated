import type { Metadata } from "next";
import { publicPage } from "@/lib/site/public-pages";

/** Applied to signed-in and account-utility routes. robots.txt is not the access control. */
export const privateRobots: Metadata["robots"] = { index: false, follow: false };

export function publicMetadata(path: string): Metadata {
  const page = publicPage(path);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.path,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: page.title,
      description: page.description,
    },
  };
}
