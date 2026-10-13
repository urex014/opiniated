import { readEnv } from "@/lib/env";

/** Origin of this deployment, without a trailing slash. Comes from APP_URL. */
export function siteOrigin(): string {
  return new URL(readEnv().appUrl).origin;
}

export function absoluteUrl(path: string): string {
  const origin = siteOrigin();
  if (path === "/" || path === "") return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
