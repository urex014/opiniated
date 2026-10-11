const ALLOWED_HOST = "api.bitlabs.ai";

export function isAllowedSurveyClickUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === ALLOWED_HOST &&
    url.pathname === "/v2/client/clicks" &&
    url.searchParams.has("s") &&
    url.searchParams.has("i")
  );
}
