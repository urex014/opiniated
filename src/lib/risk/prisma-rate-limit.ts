import { prisma } from "@/lib/db";
import type { RateLimitResult, RateLimitStore } from "@/lib/risk/rate-limit";

export const prismaRateLimitStore: RateLimitStore = {
  async consume(key, limit, windowMs, now = Date.now()) {
    try {
      return await consumeBucket(key, limit, windowMs, now);
    } catch (error) {
      console.error("rate limit store failed closed", { message: error instanceof Error ? error.message : "unknown" });
      return { allowed: false, retryAfterSeconds: 60 };
    }
  },
};

async function consumeBucket(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const bucketKey = `${key}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs * 2);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
  const count = await increment(bucketKey, expiresAt);
  if (count === 1 && windowStart % (windowMs * 20) === 0) {
    await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => undefined);
  }
  return { allowed: count <= limit, retryAfterSeconds };
}

async function increment(key: string, expiresAt: Date): Promise<number> {
  try {
    const updated = await prisma.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
    return updated.count;
  } catch (error) {
    if (!missingRow(error)) throw error;
  }
  try {
    const created = await prisma.rateLimitBucket.create({ data: { key, count: 1, expiresAt } });
    return created.count;
  } catch (error) {
    if (!duplicateKey(error)) throw error;
    const updated = await prisma.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
    return updated.count;
  }
}

function missingRow(error: unknown): boolean {
  return codeOf(error) === "P2025";
}

function duplicateKey(error: unknown): boolean {
  return codeOf(error) === "P2002";
}

function codeOf(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
}
