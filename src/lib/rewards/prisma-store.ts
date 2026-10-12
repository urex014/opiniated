import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { planReward } from "@/lib/rewards/planner";
import type { ApplyResult, RewardStore, ValidatedCallback } from "@/lib/rewards/types";

const PROVIDER = "bitlabs";
const MAX_ATTEMPTS = 3;

export function createPrismaRewardStore(): RewardStore {
  return {
    apply: (event) => applyCallback(event),
    async recordRejection(entry) {
      await prisma.postbackLog.create({
        data: {
          provider: PROVIDER,
          providerTxId: entry.providerTxId,
          outcome: entry.outcome,
          userId: entry.userId,
          type: entry.type,
        },
      });
    },
  };
}

async function applyCallback(event: ValidatedCallback): Promise<ApplyResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await applyOnce(event);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && isCallbackConflict(error)) {
        await prisma.postbackLog.create({
          data: {
            provider: PROVIDER,
            providerTxId: event.providerTxId,
            outcome: "DUPLICATE",
            userId: event.userId,
            type: event.type,
          },
        });
        return { outcome: "DUPLICATE" };
      }
      if (attempt < MAX_ATTEMPTS && isWriteConflict(error)) continue;
      throw error;
    }
  }
  throw new Error("reward transaction failed");
}

async function applyOnce(event: ValidatedCallback): Promise<ApplyResult> {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.processedCallback.findUnique({
        where: {
          provider_providerTxId: { provider: PROVIDER, providerTxId: event.providerTxId },
        },
      });
      if (existing) {
        await writeLog(tx, event, "DUPLICATE");
        return { outcome: "DUPLICATE" };
      }

      const user = isObjectId(event.userId)
        ? await tx.user.findUnique({ where: { id: event.userId } })
        : null;
      if (!user) {
        await tx.processedCallback.create({
          data: callbackRow(event, "UNKNOWN_USER"),
        });
        await writeLog(tx, event, "UNKNOWN_USER");
        return { outcome: "UNKNOWN_USER" };
      }

      if (event.disposition === "unsupported") {
        await tx.processedCallback.create({
          data: callbackRow(event, "UNSUPPORTED_EVENT"),
        });
        await writeLog(tx, event, "UNSUPPORTED_EVENT");
        return { outcome: "UNSUPPORTED_EVENT" };
      }

      const account =
        (await tx.rewardAccount.findUnique({ where: { userId: user.id } })) ??
        (await tx.rewardAccount.create({ data: { userId: user.id } }));
      const plan = planReward(
        {
          availableUnits: account.availableUnits,
          reservedUnits: account.reservedUnits,
          lifetimeCreditedUnits: account.lifetimeCreditedUnits,
        },
        event.type,
        event.amountUnits,
      );

      let transactionId: string | null = null;
      if (event.type !== "SCREENOUT") {
        const created = await tx.rewardTransaction.create({
          data: {
            userId: user.id,
            provider: PROVIDER,
            providerTxId: event.providerTxId,
            type: event.type,
            amountUnits: plan.amountUnits,
            appliedUnits: plan.appliedUnits,
            shortfallUnits: plan.shortfallUnits,
            currencyCode: event.currencyCode,
            status: plan.status,
            surveyId: event.surveyId,
            refTxId: event.refTxId,
            reason: event.reason,
            providerUsd: event.providerUsd,
          },
        });
        transactionId = created.id;
        await tx.rewardAccount.update({
          where: { userId: user.id },
          data: {
            availableUnits: plan.next.availableUnits,
            reservedUnits: plan.next.reservedUnits,
            lifetimeCreditedUnits: plan.next.lifetimeCreditedUnits,
          },
        });
      }

      if (event.surveyId) {
        await tx.surveyActivity.create({
          data: {
            userId: user.id,
            provider: PROVIDER,
            surveyId: event.surveyId,
            status: activityStatus(event.type),
            completedAt: new Date(),
            transactionId,
          },
        });
      }

      await tx.processedCallback.create({
        data: callbackRow(event, "ACCEPTED"),
      });
      await writeLog(tx, event, "ACCEPTED");
      return { outcome: "ACCEPTED", availableUnits: plan.next.availableUnits };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

function callbackRow(event: ValidatedCallback, outcome: "ACCEPTED" | "UNKNOWN_USER" | "UNSUPPORTED_EVENT") {
  return {
    provider: PROVIDER,
    providerTxId: event.providerTxId,
    outcome,
    userId: event.userId,
    type: event.type,
  };
}

function writeLog(
  tx: Prisma.TransactionClient,
  event: ValidatedCallback,
  outcome: "ACCEPTED" | "DUPLICATE" | "UNKNOWN_USER" | "UNSUPPORTED_EVENT",
) {
  return tx.postbackLog.create({
    data: {
      provider: PROVIDER,
      providerTxId: event.providerTxId,
      outcome,
      userId: event.userId,
      type: event.type,
    },
  });
}

function isCallbackConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.some((field) => field.toLowerCase().includes("providertxid"));
}

function isObjectId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function activityStatus(type: ValidatedCallback["type"]): "SCREENED_OUT" | "RECONCILED" | "COMPLETED" {
  if (type === "SCREENOUT") return "SCREENED_OUT";
  if (type === "RECONCILIATION") return "RECONCILED";
  return "COMPLETED";
}
