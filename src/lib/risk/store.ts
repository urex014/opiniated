import { prismaRateLimitStore } from "@/lib/risk/prisma-rate-limit";
import { memoryRateLimitStore, type RateLimitStore } from "@/lib/risk/rate-limit";

/** Tests share the memory buckets. Production uses MongoDB so limits survive more than one server. */
export function rateLimitStore(): RateLimitStore {
  if (process.env.VITEST === "true" || process.env.RISK_RATE_LIMIT_STORE === "memory") return memoryRateLimitStore;
  return prismaRateLimitStore;
}
