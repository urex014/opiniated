import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [consents, transactions, activities, payout, withdrawals] = await Promise.all([
    prisma.consentRecord.findMany({
      where: { userId: user.id },
      orderBy: { acceptedAt: "asc" },
      select: { document: true, version: true, action: true, acceptedAt: true },
    }),
    prisma.rewardTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        provider: true,
        type: true,
        status: true,
        amountUnits: true,
        appliedUnits: true,
        shortfallUnits: true,
        currencyCode: true,
        surveyId: true,
        createdAt: true,
      },
    }),
    prisma.surveyActivity.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { provider: true, surveyId: true, status: true, startedAt: true, completedAt: true, createdAt: true },
    }),
    prisma.payoutAccount.findUnique({
      where: { userId: user.id },
      select: { bankName: true, bankCode: true, accountLast4: true, accountName: true, recipientCode: true, updatedAt: true },
    }),
    prisma.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { points: true, amountKobo: true, currency: true, status: true, reference: true, failureReason: true, requestedAt: true, completedAt: true },
    }),
  ]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    account: {
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    },
    consents: consents.map((record) => ({
      ...record,
      acceptedAt: record.acceptedAt.toISOString(),
    })),
    transactions: transactions.map((record) => ({
      ...record,
      createdAt: record.createdAt.toISOString(),
    })),
    payoutAccount: payout
      ? { ...payout, updatedAt: payout.updatedAt.toISOString() }
      : null,
    withdrawals: withdrawals.map((record) => ({
      ...record,
      requestedAt: record.requestedAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null,
    })),
    activities: activities.map((record) => ({
      ...record,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    })),
  });
}
