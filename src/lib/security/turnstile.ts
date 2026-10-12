export type TurnstileReason = "not_configured" | "missing" | "invalid" | "unavailable";

export type TurnstileResult = { ok: true } | { ok: false; reason: TurnstileReason };

type SiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export function turnstileErrorMessage(reason: TurnstileReason): string {
  if (reason === "not_configured") {
    return "The security check is not configured. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, and TURNSTILE_HOSTNAMES.";
  }
  if (reason === "missing") return "Complete the security check before continuing.";
  if (reason === "unavailable") return "The security check could not be completed. Try again in a moment.";
  return "The security check failed. Complete it again.";
}

export async function verifyTurnstileToken(
  token: string | null,
  remoteIp: string | null,
  options: {
    secret: string | null;
    hostnames: readonly string[];
    action: string;
    fetchImpl?: typeof fetch;
  },
): Promise<TurnstileResult> {
  const allowed = new Set(options.hostnames.map((hostname) => hostname.trim().toLowerCase()).filter(Boolean));
  if (!options.secret || allowed.size === 0) return { ok: false, reason: "not_configured" };
  const responseToken = token?.trim() ?? "";
  if (!responseToken || responseToken.length > 2048) return { ok: false, reason: "missing" };

  const body = new URLSearchParams({ secret: options.secret, response: responseToken });
  if (remoteIp && remoteIp !== "local") body.set("remoteip", remoteIp);

  let payload: SiteverifyResponse;
  try {
    const response = await (options.fetchImpl ?? fetch)("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    payload = (await response.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const hostname = payload.hostname?.trim().toLowerCase() ?? "";
  if (payload.success !== true || payload.action !== options.action || !allowed.has(hostname)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}
