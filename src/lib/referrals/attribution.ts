import "server-only";
import type { Prisma } from "@prisma/client";
import { normalizeReferralCode } from "@/lib/referrals/code";

export type AttributionResult =
  | { ok: true; referralId: string; referrerId: string }
  | { ok: false; reason: "invalid_code" | "referrer_not_found" | "self_referral" | "already_attributed" };

export async function attributeReferral(
  tx: Prisma.TransactionClient,
  input: {
    referredUserId: string;
    code: string | null | undefined;
    source?: string | null;
  },
): Promise<AttributionResult> {
  const code = normalizeReferralCode(input.code);
  if (!code) return { ok: false, reason: "invalid_code" };

  const referrer = await tx.user.findUnique({
    where: { referralCode: code },
    select: { id: true, deletedAt: true },
  });

  if (!referrer || referrer.deletedAt) {
    return { ok: false, reason: "referrer_not_found" };
  }

  if (referrer.id === input.referredUserId) {
    return { ok: false, reason: "self_referral" };
  }

  const existing = await tx.referral.findUnique({
    where: { referredId: input.referredUserId },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, reason: "already_attributed" };
  }

  const created = await tx.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: input.referredUserId,
      codeUsed: code,
      source: input.source ?? "signup",
    },
  });

  return { ok: true, referralId: created.id, referrerId: referrer.id };
}
