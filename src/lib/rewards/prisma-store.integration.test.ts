import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createPrismaRewardStore } from "@/lib/rewards/prisma-store";
import { processCpxPostback, type CpxPostbackInput } from "@/lib/survey-providers/providers/cpx/callback";
import type { CpxPostbackParams } from "@/lib/survey-providers/providers/cpx/validation";

const databaseUrl = process.env.DATABASE_URL ?? "";
const enabled = databaseUrl.startsWith("mongodb://") || databaseUrl.startsWith("mongodb+srv://");
const secret = "integration-secret";

function hashFor(transId: string): string {
  return createHash("md5").update(`${transId}-${secret}`).digest("hex");
}

function input(partial: CpxPostbackParams): CpxPostbackInput {
  const trans_id = partial.trans_id ?? `tx-${randomUUID()}`;
  return {
    secureHash: secret,
    currencyCode: "PTS",
    minorUnitFactor: 1,
    params: { ...partial, trans_id, secure_hash: hashFor(trans_id) },
  };
}

describe.skipIf(!enabled)("prisma reward store", () => {
  const userIds: string[] = [];

  afterAll(async () => {
    if (userIds.length === 0) return;
    await prisma.processedCallback.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.postbackLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }, 45_000);

  async function createUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `reward-${randomUUID()}@example.com`,
        passwordHash: "test-hash",
        referralCode: `OPN${randomUUID().replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase()}`,
        rewardAccount: { create: {} },
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  it("credits a completion once, ignores the duplicate, and reverses without going negative", async () => {
    const userId = await createUser();
    const store = createPrismaRewardStore();
    const transId = `tx-${randomUUID()}`;
    const credit = input({ status: "1", user_id: userId, trans_id: transId, amount_local: "30", offer_id: "survey-1" });
    const first = await processCpxPostback(store, credit);
    const second = await processCpxPostback(store, credit);
    const reversal = await processCpxPostback(
      store,
      input({ status: "2", user_id: userId, trans_id: `rtx-${randomUUID()}`, amount_local: "50", offer_id: "survey-1" }),
    );

    const account = await prisma.rewardAccount.findUniqueOrThrow({ where: { userId } });
    const transactions = await prisma.rewardTransaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(first.outcome).toBe("ACCEPTED");
    expect(second.outcome).toBe("DUPLICATE");
    expect(reversal.outcome).toBe("ACCEPTED");
    expect(account.availableUnits).toBe(0);
    expect(account.lifetimeCreditedUnits).toBe(30);
    expect(transactions).toHaveLength(2);
    expect(transactions[1]?.shortfallUnits).toBe(20);
    expect(transactions.every((row) => row.provider === "cpx")).toBe(true);
  }, 45_000);

  it("does not double-credit concurrent callbacks for the same transaction", async () => {
    const userId = await createUser();
    const store = createPrismaRewardStore();
    const callback = input({ status: "1", user_id: userId, trans_id: `race-${randomUUID()}`, amount_local: "40" });
    const results = await Promise.all([processCpxPostback(store, callback), processCpxPostback(store, callback)]);
    const outcomes = results.map((result) => result.outcome).sort();
    const account = await prisma.rewardAccount.findUniqueOrThrow({ where: { userId } });
    expect(outcomes).toEqual(["ACCEPTED", "DUPLICATE"]);
    expect(account.availableUnits).toBe(40);
    expect(await prisma.rewardTransaction.count({ where: { userId } })).toBe(1);
  }, 45_000);

  it("leaves a historical provider row in place when the same external id arrives from CPX", async () => {
    const userId = await createUser();
    const shared = `hist-${randomUUID()}`;
    await prisma.rewardTransaction.create({
      data: {
        userId,
        provider: "bitlabs",
        providerTxId: shared,
        type: "COMPLETE",
        amountUnits: 10,
        appliedUnits: 10,
        shortfallUnits: 0,
        currencyCode: "PTS",
        status: "APPROVED",
      },
    });
    const result = await processCpxPostback(
      createPrismaRewardStore(),
      input({ status: "1", user_id: userId, trans_id: shared, amount_local: "5" }),
    );
    const rows = await prisma.rewardTransaction.findMany({ where: { userId, providerTxId: shared } });
    expect(result.outcome).toBe("ACCEPTED");
    expect(rows.map((row) => row.provider).sort()).toEqual(["bitlabs", "cpx"]);
  }, 30_000);
});
