import "server-only";
import { prisma } from "@/lib/db";

export async function getRewardSummary(userId: string) {
  const account = await prisma.rewardAccount.findUnique({ where: { userId } });
  const transactions = await prisma.rewardTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return {
    availableUnits: account?.availableUnits ?? 0,
    lifetimeCreditedUnits: account?.lifetimeCreditedUnits ?? 0,
    transactions,
  };
}

export async function listTransactions(userId: string) {
  return prisma.rewardTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const PAGE_SIZE = 20;
const FETCH_LIMIT = 100;

export async function listActivity(userId: string, page: number) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const [activities, transactions, activityCount, transactionCount] = await Promise.all([
    prisma.surveyActivity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: FETCH_LIMIT,
    }),
    prisma.rewardTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: FETCH_LIMIT,
    }),
    prisma.surveyActivity.count({ where: { userId } }),
    prisma.rewardTransaction.count({ where: { userId } }),
  ]);

  const events = [
    ...activities.map((activity) => ({
      id: `activity-${activity.id}`,
      at: activity.createdAt,
      label: activityLabel(activity.status),
      detail: `Survey ${activity.surveyId}`,
      amountUnits: null as number | null,
    })),
    ...transactions.map((transaction) => ({
      id: `transaction-${transaction.id}`,
      at: transaction.createdAt,
      label: transactionLabel(transaction.type, transaction.status, transaction.appliedUnits),
      detail: transaction.surveyId ? `Survey ${transaction.surveyId}` : "Reward adjustment",
      amountUnits: transaction.appliedUnits,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const start = (safePage - 1) * PAGE_SIZE;
  return {
    page: safePage,
    pageSize: PAGE_SIZE,
    hasMore: start + PAGE_SIZE < events.length || activityCount > FETCH_LIMIT || transactionCount > FETCH_LIMIT,
    events: events.slice(start, start + PAGE_SIZE),
  };
}

function activityLabel(status: string): string {
  if (status === "STARTED") return "Survey started";
  if (status === "COMPLETED") return "Survey completion confirmed";
  if (status === "SCREENED_OUT") return "Survey screened out";
  if (status === "RECONCILED") return "Reward reversed";
  return "Account activity";
}

function transactionLabel(type: string, status: string, appliedUnits: number): string {
  if (type === "RECONCILIATION" || status === "REVERSED") {
    return appliedUnits < 0 ? "Reward reversed" : "Reward adjusted";
  }
  if (type === "START_BONUS") return "Profile reward credited";
  return "Reward credited";
}

export { assertSameUser } from "@/lib/auth/authorize";
