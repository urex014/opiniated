import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { TELEGRAM_TASK_ID } from "./constants";
import { claimTask, hasClaimedTask } from "./service";

const databaseUrl = process.env.DATABASE_URL ?? "";
const enabled = databaseUrl.startsWith("mongodb://") || databaseUrl.startsWith("mongodb+srv://");

describe.skipIf(!enabled)("task service integration", () => {
  const userIds: string[] = [];

  afterAll(async () => {
    if (userIds.length > 0) {
      await prisma.taskClaim.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.rewardTransaction.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.rewardAccount.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }, 30_000);

  async function createUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `task-test-${randomUUID()}@example.com`,
        passwordHash: "test-hash",
        rewardAccount: { create: { availableUnits: 0, reservedUnits: 0, lifetimeCreditedUnits: 0 } },
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  it("claims a one-time task, credits 1 OPN, and rejects second attempt", async () => {
    const userId = await createUser();

    expect(await hasClaimedTask(userId, TELEGRAM_TASK_ID)).toBe(false);

    const first = await claimTask(userId, TELEGRAM_TASK_ID);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.rewardUnits).toBe(1);
    }

    expect(await hasClaimedTask(userId, TELEGRAM_TASK_ID)).toBe(true);

    const account = await prisma.rewardAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.availableUnits).toBe(1);
    expect(account.lifetimeCreditedUnits).toBe(1);

    const txs = await prisma.rewardTransaction.findMany({ where: { userId } });
    expect(txs).toHaveLength(1);
    expect(txs[0]?.provider).toBe("task");
    expect(txs[0]?.amountUnits).toBe(1);

    // Second claim attempt must fail
    const second = await claimTask(userId, TELEGRAM_TASK_ID);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("already completed and claimed");
    }

    // Balance must remain strictly 1
    const accountAfter = await prisma.rewardAccount.findUniqueOrThrow({ where: { userId } });
    expect(accountAfter.availableUnits).toBe(1);
  }, 30_000);

  it("prevents double-claiming under concurrent requests", async () => {
    const userId = await createUser();

    const results = await Promise.all([
      claimTask(userId, TELEGRAM_TASK_ID),
      claimTask(userId, TELEGRAM_TASK_ID),
    ]);

    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const account = await prisma.rewardAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.availableUnits).toBe(1);

    const claims = await prisma.taskClaim.findMany({ where: { userId } });
    expect(claims).toHaveLength(1);

    const txs = await prisma.rewardTransaction.findMany({ where: { userId } });
    expect(txs).toHaveLength(1);
  }, 30_000);
});
