import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_COMMISSION_RATE_BPS,
  MAX_COMMISSION_RATE_BPS,
  MIN_COMMISSION_RATE_BPS,
} from "@/lib/referrals/constants";

export async function getReferralCommissionRateBps(tx?: Prisma.TransactionClient): Promise<number> {
  try {
    const client = tx ?? prisma;
    const config = await client.referralConfig.findUnique({
      where: { key: "default" },
    });
    if (!config || !config.enabled) return DEFAULT_COMMISSION_RATE_BPS;
    return config.commissionRateBps;
  } catch {
    return DEFAULT_COMMISSION_RATE_BPS;
  }
}

export async function updateReferralCommissionRate(input: {
  rateBps: number;
  actorEmail: string;
}): Promise<{ ok: true; rateBps: number } | { ok: false; error: string }> {
  if (
    !Number.isInteger(input.rateBps) ||
    input.rateBps < MIN_COMMISSION_RATE_BPS ||
    input.rateBps > MAX_COMMISSION_RATE_BPS
  ) {
    return {
      ok: false,
      error: `Rate must be an integer between ${MIN_COMMISSION_RATE_BPS} (${MIN_COMMISSION_RATE_BPS / 100}%) and ${MAX_COMMISSION_RATE_BPS} (${MAX_COMMISSION_RATE_BPS / 100}%) basis points.`,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const config = await tx.referralConfig.upsert({
      where: { key: "default" },
      create: {
        key: "default",
        commissionRateBps: input.rateBps,
        enabled: true,
        updatedBy: input.actorEmail,
      },
      update: {
        commissionRateBps: input.rateBps,
        updatedBy: input.actorEmail,
      },
    });

    await tx.referralAudit.create({
      data: {
        actorId: input.actorEmail,
        action: "config.rate_update",
        targetId: config.id,
        detail: `Commission rate changed to ${input.rateBps} bps (${input.rateBps / 100}%)`,
      },
    });

    return config;
  });

  return { ok: true, rateBps: updated.commissionRateBps };
}
