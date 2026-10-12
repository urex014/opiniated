import { prisma } from "@/lib/db";
import { COMPLETION_VELOCITY_LIMIT } from "@/lib/risk/config";
import { assessAccount } from "@/lib/risk/account-check";

/**
 * A valid provider callback is already credited before this runs.
 * Velocity can open a payout review. It does not reverse the credit or reject the callback.
 */
export async function noteCreditedCompletion(userId: string, type: string | undefined): Promise<void> {
  if (type?.toUpperCase() !== "COMPLETE") return;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const completions = await prisma.rewardTransaction.count({
    where: { userId, type: "COMPLETE", createdAt: { gte: since } },
  });
  if (completions < COMPLETION_VELOCITY_LIMIT) return;
  await assessAccount({ stage: "postback", userId, ip: null, completionVelocity: true });
}
