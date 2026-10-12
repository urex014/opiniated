import type { RateLimitResult } from "@/lib/risk/rate-limit";

export function tooManyRequests(result: RateLimitResult): Response {
  return new Response("Too many requests. Wait and try again.", {
    status: 429,
    headers: {
      "retry-after": String(result.retryAfterSeconds),
      "cache-control": "no-store",
    },
  });
}
