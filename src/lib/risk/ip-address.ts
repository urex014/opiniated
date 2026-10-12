const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

type ProxyEnv = { TRUST_PROXY_HEADERS?: string; VERCEL?: string };

/** True when this process is behind a proxy that overwrites forwarding headers. */
export function trustProxyEnabled(
  env: ProxyEnv = { TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS, VERCEL: process.env.VERCEL },
): boolean {
  if (env.TRUST_PROXY_HEADERS === "true") return true;
  if (env.TRUST_PROXY_HEADERS === "false") return false;
  return env.VERCEL === "1";
}

export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const token = value.trim().replace(/^\[|\]$/g, "");
  if (!token || token.length > 64 || /[\s%]/.test(token)) return null;
  const mapped = token.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return canonicalIpv4(mapped[1] ?? "");
  if (token.includes(":")) return canonicalIpv6(token);
  return canonicalIpv4(token);
}

function canonicalIpv4(token: string): string | null {
  if (!IPV4.test(token)) return null;
  const parts = token.split(".");
  if (parts.some((part) => part.length > 1 && part.startsWith("0"))) return null;
  return parts.join(".");
}

/** RFC 5952-style lowercase form, so the same address shares one rate-limit key. */
function canonicalIpv6(token: string): string | null {
  const lowered = token.toLowerCase();
  if (!/^[0-9a-f:]+$/.test(lowered) || lowered.includes(":::")) return null;
  const pieces = lowered.split("::");
  if (pieces.length > 2) return null;
  const head = pieces[0] ? pieces[0].split(":") : [];
  const tail = pieces.length === 2 ? (pieces[1] ? pieces[1].split(":") : []) : [];
  if (pieces.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (pieces.length === 2 && missing < 1) return null;
  const groups = pieces.length === 2 ? [...head, ...Array.from({ length: missing }, () => "0"), ...tail] : head;
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  const words = groups.map((group) => group.replace(/^0+(?=[0-9a-f])/, ""));
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let index = 0; index <= words.length; index += 1) {
    if (index < words.length && words[index] === "0") {
      if (runStart < 0) runStart = index;
      continue;
    }
    if (runStart < 0) continue;
    const length = index - runStart;
    if (length > bestLength) {
      bestStart = runStart;
      bestLength = length;
    }
    runStart = -1;
  }
  if (bestLength < 2) return words.join(":");
  return `${words.slice(0, bestStart).join(":")}::${words.slice(bestStart + bestLength).join(":")}`;
}

/**
 * Reads the client address only when the deployment says the headers are trustworthy.
 * A browser-supplied X-Forwarded-For is ignored otherwise.
 */
export function clientIp(headers: Headers, trustProxy = trustProxyEnabled()): string | null {
  if (!trustProxy) return null;
  const realIp = normalizeIp(headers.get("x-real-ip"));
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  return normalizeIp(forwarded.split(",")[0]);
}
