import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { prismaRateLimitStore } from "@/lib/risk/prisma-rate-limit";

const databaseUrl = process.env.DATABASE_URL ?? "";
const enabled = databaseUrl.startsWith("mongodb://") || databaseUrl.startsWith("mongodb+srv://");

describe.skipIf(!enabled)("mongo rate limit buckets", () => {
  const prefix = `risk-test:${randomUUID()}`;

  afterAll(async () => {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: prefix } } });
    await prisma.$disconnect();
  }, 30_000);

  it("increments one bucket under concurrent requests", async () => {
    const now = Date.now();
    const results = await Promise.all(Array.from({ length: 12 }, () => prismaRateLimitStore.consume(prefix, 4, 60_000, now)));
    expect(results.filter((result) => result.allowed)).toHaveLength(4);
    const windowStart = Math.floor(now / 60_000) * 60_000;
    const row = await prisma.rateLimitBucket.findUnique({ where: { key: `${prefix}:${windowStart}` } });
    expect(row?.count).toBe(12);
  }, 30_000);
});
