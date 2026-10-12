const ALLOWED = ["/dashboard", "/surveys", "/rewards", "/payouts", "/activity", "/account", "/admin"];

/** Keep post-login redirects on this site's account pages. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/dashboard";
  const path = value.split("?")[0] ?? "";
  if (!ALLOWED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return "/dashboard";
  return value;
}
