import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site/origin";

const privatePaths = [
  "/dashboard",
  "/surveys",
  "/rewards",
  "/payouts",
  "/activity",
  "/account",
  "/admin",
  "/api/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privatePaths,
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
