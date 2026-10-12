import { rateLimitStore } from "@/lib/risk/store";

export const AUTH_LIMITS = {
  register: { limit: 8, windowMs: 15 * 60 * 1000 },
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  forgot: { limit: 6, windowMs: 15 * 60 * 1000 },
  reset: { limit: 8, windowMs: 15 * 60 * 1000 },
  verify: { limit: 6, windowMs: 15 * 60 * 1000 },
} as const;

export type AuthLimitKind = keyof typeof AUTH_LIMITS;

export async function allowAuthAttempt(kind: AuthLimitKind, ip: string, subject = ""): Promise<boolean> {
  const policy = AUTH_LIMITS[kind];
  const key = subject ? `${kind}:${ip}:${subject}` : `${kind}:${ip}`;
  const result = await rateLimitStore().consume(key, policy.limit, policy.windowMs);
  return result.allowed;
}
