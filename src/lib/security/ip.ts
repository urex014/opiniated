export const BITLABS_CALLBACK_IPS = [
  "20.76.54.40",
  "20.76.54.41",
  "20.76.54.42",
  "20.76.54.43",
  "20.76.54.44",
  "20.76.54.45",
  "20.76.54.46",
  "20.76.54.47",
  "18.199.243.90",
  "18.157.62.114",
  "18.193.24.206",
] as const;

export function isBitlabsCallbackIp(ip: string | null): boolean {
  if (!ip) return false;
  return (BITLABS_CALLBACK_IPS as readonly string[]).includes(ip);
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim();
  return first || null;
}
