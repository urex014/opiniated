import "server-only";
import type { Prisma } from "@prisma/client";
import { planReward } from "@/lib/rewards/planner";
import type { ValidatedCallback } from "@/lib/rewards/types";
import { heldUserIds } from "@/lib/risk/persist";
import { REFERRAL_PROVIDER_ID } from "@/lib/referrals/constants";
import { calculateReferralSplit } from "@/lib/referrals/math";

export type ReferralProcessResult =
  | { outcome: "NOT_REFERRED" }
  | { outcome: "DUPLICATE" }
  | { outcome: "COMMISSION_CREDITED"; amountUnits: number; referrerId: string }
  | { outcome: "COMMISSION_HELD"; amountUnits: number; referrerId: string }
  | { outcome: "COMMISSION_REVERSED"; amountUnits: number; referrerId: string }
  | { outcome: "IGNORED" };

export async function processReferralForEvent(
  tx: Prisma.TransactionClient,
  event: ValidatedCallback,
  commissionRateBps: number,
): Promise<ReferralProcessResult> {
  const referral = await tx.referral.findUnique({
    where: { referredId: event.userId },
  });
  if (!referral) return { outcome: "NOT_REFERRED" };

  if (event.type === "COMPLETE") {
    return handleCompletionCommission(tx, referral, event, commissionRateBps);
  }

  if (event.type === "RECONCILIATION") {
    return handleReversalCommission(tx, referral, event);
  }

  return { outcome: "IGNORED" };
}

async function handleCompletionCommission(
  tx: Prisma.TransactionClient,
  referral: { id: string; referrerId: string; referredId: string },
  event: ValidatedCallback,
  commissionRateBps: number,
): Promise<ReferralProcessResult> {
  const existing = await tx.referralCommission.findUnique({
    where: {
      provider_providerTxId_eventType: {
        provider: event.provider,
        providerTxId: event.providerTxId,
        eventType: "CREDIT",
      },
    },
  });
  if (existing) return { outcome: "DUPLICATE" };

  const split = calculateReferralSplit({
    userRewardUnits: event.amountUnits,
    providerUsd: event.providerUsd,
    commissionRateBps,
  });
  if (!split || split.commissionUnits <= 0) return { outcome: "IGNORED" };

  const held = await heldUserIds([referral.referrerId, referral.referredId]);
  const isHeld = held.has(referral.referrerId) || held.has(referral.referredId);

  const status = isHeld ? "HELD" : "APPROVED";
  const holdReason = isHeld ? "Referrer or referred account under risk hold" : null;

  await tx.referralCommission.create({
    data: {
      referralId: referral.id,
      referrerId: referral.referrerId,
      referredId: referral.referredId,
      provider: event.provider,
      providerTxId: event.providerTxId,
      eventType: "CREDIT",
      status,
      grossAmountUsd: split.grossAmountUsd,
      userRewardUnits: split.userRewardUnits,
      opiniatedShareUnits: split.opiniatedShareUnits,
      commissionRateBps: split.commissionRateBps,
      amountUnits: split.commissionUnits,
      currencyCode: event.currencyCode,
      holdReason,
    },
  });

  if (isHeld) {
    return { outcome: "COMMISSION_HELD", amountUnits: split.commissionUnits, referrerId: referral.referrerId };
  }

  await tx.rewardAccount.upsert({
    where: { userId: referral.referrerId },
    create: {
      userId: referral.referrerId,
      availableUnits: split.commissionUnits,
      lifetimeCreditedUnits: split.commissionUnits,
    },
    update: {
      availableUnits: { increment: split.commissionUnits },
      lifetimeCreditedUnits: { increment: split.commissionUnits },
    },
  });

  await tx.rewardTransaction.create({
    data: {
      userId: referral.referrerId,
      provider: REFERRAL_PROVIDER_ID,
      providerTxId: `ref:${event.provider}:${event.providerTxId}`,
      type: "COMPLETE",
      amountUnits: split.commissionUnits,
      appliedUnits: split.commissionUnits,
      shortfallUnits: 0,
      currencyCode: event.currencyCode,
      status: "APPROVED",
      surveyId: event.surveyId,
      refTxId: event.providerTxId,
      reason: `Referral commission (${split.commissionRateBps / 100}% of Opiniated share)`,
      providerUsd: event.providerUsd,
    },
  });

  return { outcome: "COMMISSION_CREDITED", amountUnits: split.commissionUnits, referrerId: referral.referrerId };
}

async function handleReversalCommission(
  tx: Prisma.TransactionClient,
  referral: { id: string; referrerId: string; referredId: string },
  event: ValidatedCallback,
): Promise<ReferralProcessResult> {
  const originalTxId = event.refTxId ?? event.providerTxId.replace(/:reversal$/, "");
  const original = await tx.referralCommission.findFirst({
    where: {
      provider: event.provider,
      providerTxId: originalTxId,
      eventType: "CREDIT",
    },
  });

  if (!original || original.status !== "APPROVED") {
    return { outcome: "IGNORED" };
  }

  const existingReversal = await tx.referralCommission.findUnique({
    where: {
      provider_providerTxId_eventType: {
        provider: event.provider,
        providerTxId: event.providerTxId,
        eventType: "REVERSAL",
      },
    },
  });
  if (existingReversal) return { outcome: "DUPLICATE" };

  await tx.referralCommission.update({
    where: { id: original.id },
    data: { status: "REVERSED" },
  });

  await tx.referralCommission.create({
    data: {
      referralId: original.referralId,
      referrerId: original.referrerId,
      referredId: original.referredId,
      provider: event.provider,
      providerTxId: event.providerTxId,
      eventType: "REVERSAL",
      status: "REVERSED",
      grossAmountUsd: event.providerUsd,
      userRewardUnits: event.amountUnits,
      opiniatedShareUnits: -original.opiniatedShareUnits,
      commissionRateBps: original.commissionRateBps,
      amountUnits: -original.amountUnits,
      currencyCode: event.currencyCode,
      refTxId: original.providerTxId,
    },
  });

  const account = await tx.rewardAccount.findUnique({
    where: { userId: original.referrerId },
  });
  if (account) {
    const plan = planReward(
      {
        availableUnits: account.availableUnits,
        reservedUnits: account.reservedUnits,
        lifetimeCreditedUnits: account.lifetimeCreditedUnits,
      },
      "RECONCILIATION",
      -original.amountUnits,
    );

    await tx.rewardAccount.update({
      where: { userId: original.referrerId },
      data: {
        availableUnits: plan.next.availableUnits,
        reservedUnits: plan.next.reservedUnits,
        lifetimeCreditedUnits: plan.next.lifetimeCreditedUnits,
      },
    });

    await tx.rewardTransaction.create({
      data: {
        userId: original.referrerId,
        provider: REFERRAL_PROVIDER_ID,
        providerTxId: `ref:${event.provider}:${event.providerTxId}:reversal`,
        type: "RECONCILIATION",
        amountUnits: plan.amountUnits,
        appliedUnits: plan.appliedUnits,
        shortfallUnits: plan.shortfallUnits,
        currencyCode: event.currencyCode,
        status: "REVERSED",
        surveyId: event.surveyId,
        refTxId: original.providerTxId,
        reason: `Referral commission reversal for survey ${original.providerTxId}`,
        providerUsd: event.providerUsd,
      },
    });
  }

  return { outcome: "COMMISSION_REVERSED", amountUnits: original.amountUnits, referrerId: original.referrerId };
}
