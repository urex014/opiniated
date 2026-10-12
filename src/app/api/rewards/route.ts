import { getCurrentUser } from "@/lib/auth/current-user";
import { tooManyRequests } from "@/lib/risk/http";
import { rateLimitStore } from "@/lib/risk/store";
import { getRewardSummary } from "@/lib/rewards/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const limit = await rateLimitStore().consume(`rewards:read:${user.id}`, 60, 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit);
  const summary = await getRewardSummary(user.id);
  return Response.json({
    availableUnits: summary.availableUnits,
    reservedUnits: summary.reservedUnits,
    spendableUnits: summary.spendableUnits,
    lifetimeCreditedUnits: summary.lifetimeCreditedUnits,
    transactions: summary.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      appliedUnits: transaction.appliedUnits,
      amountUnits: transaction.amountUnits,
      surveyId: transaction.surveyId,
      createdAt: transaction.createdAt.toISOString(),
    })),
  });
}
