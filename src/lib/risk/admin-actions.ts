"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/payouts/access";
import { reviewDecision } from "@/lib/risk/review-decision";

export async function reviewRiskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!isAdminEmail(user.email, readEnv().adminEmails)) redirect("/admin/risk?error=denied");
  const reviewId = String(formData.get("reviewId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  const decision = reviewDecision(String(formData.get("intent") ?? ""));
  if (!note || !decision || reviewId.length < 8) redirect("/admin/risk?error=invalid");
  const updated = await prisma.riskReview.updateMany({
    where: { id: reviewId },
    data: { status: decision.status, scope: decision.scope, note, resolvedBy: user.id, resolvedAt: new Date() },
  });
  if (updated.count !== 1) redirect("/admin/risk?error=missing");
  await prisma.riskAudit.create({
    data: { actorId: user.id, reviewId, action: decision.action, note },
  });
  revalidatePath("/admin/risk");
  revalidatePath("/payouts");
  redirect("/admin/risk?saved=1");
}
