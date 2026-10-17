import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { TELEGRAM_TASK_ID, TELEGRAM_TASK_REWARD_UNITS } from "./constants";

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      taskClaim: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      rewardAccount: {
        upsert: vi.fn(),
      },
      rewardTransaction: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/env", () => ({
  readEnv: vi.fn(() => ({
    rewardCurrencyCode: "OPN",
    rewardMinorUnitFactor: 1,
  })),
}));

import { prisma } from "@/lib/db";
import { hasClaimedTask, claimTask } from "./service";

describe("task service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasClaimedTask", () => {
    it("returns false if no claim record is found", async () => {
      vi.mocked(prisma.taskClaim.findUnique).mockResolvedValue(null);
      const claimed = await hasClaimedTask("user-1", TELEGRAM_TASK_ID);
      expect(claimed).toBe(false);
      expect(prisma.taskClaim.findUnique).toHaveBeenCalledWith({
        where: {
          userId_taskId: {
            userId: "user-1",
            taskId: TELEGRAM_TASK_ID,
          },
        },
        select: { id: true },
      });
    });

    const mockClaim = {
      id: "claim-1",
      userId: "user-1",
      taskId: TELEGRAM_TASK_ID,
      rewardUnits: 1,
      claimedAt: new Date(),
    };

    it("returns true when a claim record exists", async () => {
      vi.mocked(prisma.taskClaim.findUnique).mockResolvedValue(mockClaim);
      const claimed = await hasClaimedTask("user-1", TELEGRAM_TASK_ID);
      expect(claimed).toBe(true);
    });
  });

  describe("claimTask", () => {
    it("rejects unrecognized task IDs", async () => {
      const result = await claimTask("user-1", "non_existent_task");
      expect(result).toEqual({ ok: false, error: "Unrecognized task." });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects if task was already claimed", async () => {
      vi.mocked(prisma.taskClaim.findUnique).mockResolvedValue({
        id: "claim-1",
        userId: "user-1",
        taskId: TELEGRAM_TASK_ID,
        rewardUnits: 1,
        claimedAt: new Date(),
      });

      const result = await claimTask("user-1", TELEGRAM_TASK_ID);
      expect(result).toEqual({
        ok: false,
        error: "You have already completed and claimed this task.",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("successfully creates claim, credits account, and records transaction", async () => {
      vi.mocked(prisma.taskClaim.findUnique).mockResolvedValue(null);

      const mockTx = {
        taskClaim: { create: vi.fn() },
        rewardAccount: { upsert: vi.fn() },
        rewardTransaction: { create: vi.fn() },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: unknown) => {
        return (callback as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
      });

      const result = await claimTask("user-1", TELEGRAM_TASK_ID);

      expect(result).toEqual({
        ok: true,
        rewardUnits: TELEGRAM_TASK_REWARD_UNITS,
        message: "1 OPN has been added to your balance.",
      });

      expect(mockTx.taskClaim.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          taskId: TELEGRAM_TASK_ID,
          rewardUnits: 1,
          telegramUserId: null,
          telegramUsername: null,
        },
      });

      expect(mockTx.rewardAccount.upsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        create: {
          userId: "user-1",
          availableUnits: 1,
          lifetimeCreditedUnits: 1,
        },
        update: {
          availableUnits: { increment: 1 },
          lifetimeCreditedUnits: { increment: 1 },
        },
      });

      expect(mockTx.rewardTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          provider: "task",
          providerTxId: `task:${TELEGRAM_TASK_ID}:user-1`,
          type: "COMPLETE",
          amountUnits: 1,
          appliedUnits: 1,
          shortfallUnits: 0,
          currencyCode: "OPN",
          status: "APPROVED",
          reason: "One-time task: Join our Telegram community",
        },
      });
    });

    it("prevents double-claiming under concurrent race conditions (P2002 error)", async () => {
      vi.mocked(prisma.taskClaim.findUnique).mockResolvedValue(null);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`userId`,`taskId`)",
        { code: "P2002", clientVersion: "6.0.0" }
      );

      vi.mocked(prisma.$transaction).mockRejectedValue(p2002Error);

      const result = await claimTask("user-1", TELEGRAM_TASK_ID);

      expect(result).toEqual({
        ok: false,
        error: "You have already completed and claimed this task.",
      });
    });

    it("retries on write conflicts before successfully executing transaction", async () => {
      vi.mocked(prisma.taskClaim.findUnique).mockResolvedValue(null);

      const mockTx = {
        taskClaim: { create: vi.fn() },
        rewardAccount: { upsert: vi.fn() },
        rewardTransaction: { create: vi.fn() },
      };

      const writeConflictError = new Error("Transaction failed due to a write conflict or a deadlock.");

      let callCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: unknown) => {
        callCount++;
        if (callCount === 1) {
          throw writeConflictError;
        }
        return (callback as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
      });

      const result = await claimTask("user-1", TELEGRAM_TASK_ID);

      expect(callCount).toBe(2);
      expect(result.ok).toBe(true);
      expect(mockTx.taskClaim.create).toHaveBeenCalledTimes(1);
    });
  });
});
