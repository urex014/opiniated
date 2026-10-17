import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { LEDGER_PROVIDER } from "@/lib/payouts/constants";
import { prismaPayouts } from "@/lib/payouts/prisma-repository";
import { createWithdrawalReference } from "@/lib/payouts/reference";

const databaseUrl = process.env.DATABASE_URL ?? "";
const enabled = databaseUrl.startsWith("mongodb://") || databaseUrl.startsWith("mongodb+srv://");

describe.skipIf(!enabled)("prisma payout reservations", () => {
  const userIds: string[] = [];

  afterAll(async () => {
    if (userIds.length === 0) return;
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, reference: true },
    });
    const ids = withdrawals.map((row) => row.id);
    const references = withdrawals.flatMap((row) => [row.reference, `${row.reference}:reversal`]);
    if (ids.length > 0) {
      await prisma.transferAttempt.deleteMany({ where: { withdrawalId: { in: ids } } });
      await prisma.payoutAudit.deleteMany({ where: { OR: [{ withdrawalId: { in: ids } }, { actorId: { in: userIds } }] } });
      await prisma.withdrawal.deleteMany({ where: { id: { in: ids } } });
    }
    if (references.length > 0) {
      await prisma.rewardTransaction.deleteMany({ where: { provider: LEDGER_PROVIDER, providerTxId: { in: references } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }, 30_000);

  it(
    "lets only one of two concurrent withdrawals reserve the same balance",
    async () => {
      const user = await prisma.user.create({
        data: {
          email: `payout-${randomUUID()}@example.com`,
          passwordHash: "test-hash",
          rewardAccount: { create: { availableUnits: 100, reservedUnits: 0, lifetimeCreditedUnits: 100 } },
          payoutAccount: {
            create: {
              bankCode: "058",
              bankName: "Guaranty Trust Bank",
              accountLast4: "6789",
              accountName: "TEST USER",
              recipientCode: `RCP_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
            },
          },
        },
      });
      userIds.push(user.id);

      const request = () =>
        prismaPayouts.requestWithdrawal({
          userId: user.id,
          points: 80,
          amountKobo: 8000,
          minimumKobo: 100,
          reference: createWithdrawalReference(1),
          status: "PENDING",
          currencyCode: "PTS",
          at: new Date(),
        });
      const [first, second] = await Promise.all([request(), request()]);
      expect([first, second].filter((result) => result.ok)).toHaveLength(1);

      const account = await prisma.rewardAccount.findUnique({ where: { userId: user.id } });
      expect(account?.availableUnits).toBe(100);
      expect(account?.reservedUnits).toBe(80);
      expect(await prisma.withdrawal.count({ where: { userId: user.id } })).toBe(1);
    },
    30_000,
  );
});
