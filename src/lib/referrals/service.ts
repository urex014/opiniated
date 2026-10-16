import "server-only";
import { prisma } from "@/lib/db";
import { REFERRAL_PROVIDER_ID } from "@/lib/referrals/constants";
import { referralLink } from "@/lib/referrals/code";
import { getReferralCommissionRateBps } from "@/lib/referrals/config";
import { planReward } from "@/lib/rewards/planner";

import type { UserReferralSummary, AdminReferralSummary, CommissionReviewInput } from "./types";
export type { UserReferralSummary, AdminReferralSummary, CommissionReviewInput };

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "User";
  const maskedLocal = local.length <= 2
    ? `${local[0]}*`
    : `${local.slice(0, 2)}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

export async function getUserReferralSummary(userId: string): Promise<UserReferralSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!user || !user.referralCode) return null;

  const [referrals, commissions] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            transactions: {
              where: { type: "COMPLETE", status: "APPROVED" },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.referralCommission.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  let approvedUnits = 0;
  let heldUnits = 0;
  let reversedUnits = 0;

  for (const c of commissions) {
    if (c.eventType === "CREDIT") {
      if (c.status === "APPROVED") approvedUnits += c.amountUnits;
      else if (c.status === "HELD") heldUnits += c.amountUnits;
      else if (c.status === "REVERSED") reversedUnits += c.amountUnits;
    }
  }

  const referralItems = referrals.map((r) => {
    const isQualified = (r.referred.transactions?.length ?? 0) > 0;
    return {
      id: r.id,
      maskedEmail: maskEmail(r.referred.email),
      signupDate: r.createdAt,
      isQualified,
    };
  });

  const qualifiedCount = referralItems.filter((r) => r.isQualified).length;
  const pendingCount = referralItems.length - qualifiedCount;

  return {
    referralCode: user.referralCode,
    referralLink: referralLink(user.referralCode),
    totalInvited: referrals.length,
    pendingCount,
    qualifiedCount,
    totalEarningsUnits: approvedUnits,
    approvedEarningsUnits: approvedUnits,
    heldEarningsUnits: heldUnits,
    reversedEarningsUnits: reversedUnits,
    referrals: referralItems,
    commissions: commissions.map((c) => ({
      id: c.id,
      amountUnits: c.amountUnits,
      status: c.status,
      eventType: c.eventType,
      createdAt: c.createdAt,
      surveyTxId: c.providerTxId,
    })),
  };
}

export async function getAdminReferralOverview() {
  const [totalReferrals, commissions, currentRateBps, audits] = await Promise.all([
    prisma.referral.count(),
    prisma.referralCommission.findMany({
      select: {
        status: true,
        eventType: true,
        amountUnits: true,
        opiniatedShareUnits: true,
        userRewardUnits: true,
      },
    }),
    getReferralCommissionRateBps(),
    prisma.referralAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  let approvedCommissionsUnits = 0;
  let heldCommissionsUnits = 0;
  let reversedCommissionsUnits = 0;
  let totalUserRewardUnits = 0;
  let totalOpiniatedShareUnits = 0;

  for (const c of commissions) {
    if (c.eventType === "CREDIT") {
      totalUserRewardUnits += c.userRewardUnits;
      totalOpiniatedShareUnits += c.opiniatedShareUnits;
      if (c.status === "APPROVED") approvedCommissionsUnits += c.amountUnits;
      else if (c.status === "HELD") heldCommissionsUnits += c.amountUnits;
      else if (c.status === "REVERSED") reversedCommissionsUnits += c.amountUnits;
    }
  }

  const qualifiedReferrals = await prisma.referral.count({
    where: {
      referred: {
        transactions: {
          some: { type: "COMPLETE", status: "APPROVED" },
        },
      },
    },
  });

  const qualificationRate = totalReferrals > 0
    ? Math.round((qualifiedReferrals / totalReferrals) * 100)
    : 0;

  // Gross = User Rewards (40%) + Opiniated Share (60%)
  const grossProviderRevenueUnits = totalUserRewardUnits + totalOpiniatedShareUnits;
  const netRetainedRevenueUnits = totalOpiniatedShareUnits - approvedCommissionsUnits;

  return {
    totalReferrals,
    qualifiedReferrals,
    qualificationRate,
    currentRateBps,
    approvedCommissionsUnits,
    heldCommissionsUnits,
    reversedCommissionsUnits,
    grossProviderRevenueUnits,
    totalUserRewardUnits,
    totalOpiniatedShareUnits,
    netRetainedRevenueUnits,
    recentAudits: audits,
  };
}

export async function setCommissionHold(input: {
  commissionId: string;
  action: "hold" | "release";
  reason: string;
  actorEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return prisma.$transaction(async (tx) => {
    const commission = await tx.referralCommission.findUnique({
      where: { id: input.commissionId },
    });
    if (!commission) return { ok: false, error: "Commission not found" };

    if (input.action === "hold") {
      if (commission.status !== "APPROVED") {
        return { ok: false, error: `Cannot hold commission with status ${commission.status}` };
      }

      await tx.referralCommission.update({
        where: { id: commission.id },
        data: { status: "HELD", holdReason: input.reason },
      });

      const account = await tx.rewardAccount.findUnique({
        where: { userId: commission.referrerId },
      });
      if (account) {
        const plan = planReward(
          {
            availableUnits: account.availableUnits,
            reservedUnits: account.reservedUnits,
            lifetimeCreditedUnits: account.lifetimeCreditedUnits,
          },
          "RECONCILIATION",
          -commission.amountUnits,
        );

        await tx.rewardAccount.update({
          where: { userId: commission.referrerId },
          data: {
            availableUnits: plan.next.availableUnits,
            reservedUnits: plan.next.reservedUnits,
            lifetimeCreditedUnits: plan.next.lifetimeCreditedUnits,
          },
        });

        await tx.rewardTransaction.create({
          data: {
            userId: commission.referrerId,
            provider: REFERRAL_PROVIDER_ID,
            providerTxId: `ref:hold:${commission.id}`,
            type: "RECONCILIATION",
            amountUnits: plan.amountUnits,
            appliedUnits: plan.appliedUnits,
            shortfallUnits: plan.shortfallUnits,
            currencyCode: commission.currencyCode,
            status: "HELD",
            reason: `Admin hold: ${input.reason}`,
          },
        });
      }

      await tx.referralAudit.create({
        data: {
          actorId: input.actorEmail,
          action: "commission.hold",
          targetId: commission.id,
          detail: input.reason,
        },
      });

      return { ok: true };
    }

    if (input.action === "release") {
      if (commission.status !== "HELD") {
        return { ok: false, error: `Cannot release commission with status ${commission.status}` };
      }

      await tx.referralCommission.update({
        where: { id: commission.id },
        data: { status: "APPROVED", holdReason: null },
      });

      await tx.rewardAccount.upsert({
        where: { userId: commission.referrerId },
        create: {
          userId: commission.referrerId,
          availableUnits: commission.amountUnits,
          lifetimeCreditedUnits: commission.amountUnits,
        },
        update: {
          availableUnits: { increment: commission.amountUnits },
          lifetimeCreditedUnits: { increment: commission.amountUnits },
        },
      });

      await tx.rewardTransaction.create({
        data: {
          userId: commission.referrerId,
          provider: REFERRAL_PROVIDER_ID,
          providerTxId: `ref:release:${commission.id}`,
          type: "COMPLETE",
          amountUnits: commission.amountUnits,
          appliedUnits: commission.amountUnits,
          shortfallUnits: 0,
          currencyCode: commission.currencyCode,
          status: "APPROVED",
          reason: `Admin release: ${input.reason}`,
        },
      });

      await tx.referralAudit.create({
        data: {
          actorId: input.actorEmail,
          action: "commission.release",
          targetId: commission.id,
          detail: input.reason,
        },
      });

      return { ok: true };
    }

    return { ok: false, error: "Invalid action" };
  });
}
