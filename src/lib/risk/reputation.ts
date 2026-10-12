export type Reputation = "clean" | "malicious" | "unknown";

export type ReputationLookup = {
  url: string | null;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

/**
 * Optional adapter. No vendor is configured by default.
 * A timeout or a bad response is `unknown`, which must not block traffic.
 * A malicious result is a review signal, not a permanent ban.
 */
export async function lookupIpReputation(ip: string, options: ReputationLookup): Promise<Reputation> {
  if (!options.url) return "unknown";
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetchImpl(`${options.url}${options.url.includes("?") ? "&" : "?"}ip=${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return "unknown";
    const body = (await response.json()) as { malicious?: unknown };
    if (body.malicious === true) return "malicious";
    if (body.malicious === false) return "clean";
    return "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}
