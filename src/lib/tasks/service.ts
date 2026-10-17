import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { TASKS, TASK_PROVIDER_ID, type TaskDefinition } from "./constants";

export type ClaimTaskResult =
  | { ok: true; rewardUnits: number; message: string }
  | { ok: false; error: string };

export async function hasClaimedTask(userId: string, taskId: string): Promise<boolean> {
  const claim = await prisma.taskClaim.findUnique({
    where: {
      userId_taskId: {
        userId,
        taskId,
      },
    },
    select: { id: true },
  });
  return Boolean(claim);
}

export type TaskClaimMeta = {
  telegramUserId?: string;
  telegramUsername?: string;
};

export async function claimTask(
  userId: string,
  taskId: string,
  meta?: TaskClaimMeta
): Promise<ClaimTaskResult> {
  const task: TaskDefinition | undefined = TASKS[taskId];
  if (!task) {
    return { ok: false, error: "Unrecognized task." };
  }

  const alreadyClaimed = await hasClaimedTask(userId, taskId);
  if (alreadyClaimed) {
    return { ok: false, error: "You have already completed and claimed this task." };
  }

  if (meta?.telegramUserId) {
    const existingTgClaim = await prisma.taskClaim.findFirst({
      where: {
        taskId,
        telegramUserId: meta.telegramUserId,
      },
      select: { id: true, userId: true },
    });
    if (existingTgClaim && existingTgClaim.userId !== userId) {
      return {
        ok: false,
        error: "This Telegram account has already been used to claim this reward on another profile.",
      };
    }
  }

  const env = readEnv();
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.taskClaim.create({
          data: {
            userId,
            taskId,
            rewardUnits: task.rewardUnits,
            telegramUserId: meta?.telegramUserId ?? null,
            telegramUsername: meta?.telegramUsername ?? null,
          },
        });

        await tx.rewardAccount.upsert({
          where: { userId },
          create: {
            userId,
            availableUnits: task.rewardUnits,
            lifetimeCreditedUnits: task.rewardUnits,
          },
          update: {
            availableUnits: { increment: task.rewardUnits },
            lifetimeCreditedUnits: { increment: task.rewardUnits },
          },
        });

        await tx.rewardTransaction.create({
          data: {
            userId,
            provider: TASK_PROVIDER_ID,
            providerTxId: `task:${taskId}:${userId}`,
            type: "COMPLETE",
            amountUnits: task.rewardUnits,
            appliedUnits: task.rewardUnits,
            shortfallUnits: 0,
            currencyCode: env.rewardCurrencyCode,
            status: "APPROVED",
            reason: `One-time task: ${task.title}`,
          },
        });
      }, { maxWait: 10_000, timeout: 20_000 });

      return {
        ok: true,
        rewardUnits: task.rewardUnits,
        message: `${task.rewardUnits} OPN has been added to your balance.`,
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { ok: false, error: "You have already completed and claimed this task." };
      }
      if (attempt < maxAttempts && isWriteConflict(error)) {
        await delay(attempt * 50);
        continue;
      }
      throw error;
    }
  }

  return { ok: false, error: "Unable to process claim at this time. Please try again." };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return true;
  }
  return error instanceof Error && /duplicate key|E11000/i.test(error.message);
}

function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return true;
  }
  return error instanceof Error && /write conflict|deadlock/i.test(error.message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
