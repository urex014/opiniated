import { createHmac, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processPostback, type PostbackParams } from "@/lib/rewards/process-postback";
import { createPrismaRewardStore } from "@/lib/rewards/prisma-store";

const databaseUrl = process.env.DATABASE_URL ?? "";
const enabled = databaseUrl.startsWith("mongodb://") || databaseUrl.startsWith("mongodb+srv://");
const secret = "integration-secret";

function signed(params: PostbackParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const unsigned = `https://opiniated.example/api/bitlabs/postback?${search.toString()}`;
  const hash = createHmac("sha1", secret).update(unsigned).digest("hex");
  return `${unsigned}&hash=${hash}`;
}

describe.skipIf(!enabled)("prisma reward store", () => {
  const userIds: string[] = [];

  afterAll(async () => {
    if (userIds.length === 0) return;
    await prisma.processedCallback.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.postbackLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function createUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `reward-${randomUUID()}@example.com`,
        passwordHash: "test-hash",
        rewardAccount: { create: {} },
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  it("credits a completion once, ignores the duplicate, and reverses without going negative", async () => {
    const userId = await createUser();
    const store = createPrismaRewardStore();
    const credit = { uid: userId, tx: `tx-${randomUUID()}`, val: "30", type: "COMPLETE", survey_id: "survey-1" };
    const first = await processPostback(store, {
      fullUrl: signed(credit),
      secret,
      params: credit,
      currencyCode: "PTS",
      minorUnitFactor: 1,
    });
    const second = await processPostback(store, {
      fullUrl: signed(credit),
      secret,
      params: credit,
      currencyCode: "PTS",
      minorUnitFactor: 1,
    });
    const reversalParams = {
      uid: userId,
      tx: `rtx-${randomUUID()}`,
      val: "-50",
      type: "RECONCILIATION",
      ref: credit.tx,
    };
    const reversal = await processPostback(store, {
      fullUrl: signed(reversalParams),
      secret,
      params: reversalParams,
      currencyCode: "PTS",
      minorUnitFactor: 1,
    });

    const account = await prisma.rewardAccount.findUniqueOrThrow({ where: { userId } });
    const transactions = await prisma.rewardTransaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(first.outcome).toBe("ACCEPTED");
    expect(second.outcome).toBe("DUPLICATE");
    expect(reversal.outcome).toBe("ACCEPTED");
    expect(account.availableUnits).toBe(0);
    expect(account.lifetimeCreditedUnits).toBe(30);
    expect(transactions).toHaveLength(2);
    expect(transactions[1]?.shortfallUnits).toBe(20);
  }, 30_000);

  it("does not double-credit concurrent callbacks for the same transaction", async () => {
    const userId = await createUser();
    const store = createPrismaRewardStore();
    const params = { uid: userId, tx: `race-${randomUUID()}`, val: "40", type: "COMPLETE" };
    const input = {
      fullUrl: signed(params),
      secret,
      params,
      currencyCode: "PTS",
      minorUnitFactor: 1,
    };
    const results = await Promise.all([processPostback(store, input), processPostback(store, input)]);
    const outcomes = results.map((result) => result.outcome).sort();
    const account = await prisma.rewardAccount.findUniqueOrThrow({ where: { userId } });
    expect(outcomes).toEqual(["ACCEPTED", "DUPLICATE"]);
    expect(account.availableUnits).toBe(40);
    expect(await prisma.rewardTransaction.count({ where: { userId } })).toBe(1);
  }, 30_000);
});
