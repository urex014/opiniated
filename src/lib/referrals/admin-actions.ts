"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/payouts/access";
import { updateReferralCommissionRate } from "@/lib/referrals/config";
import { setCommissionHold } from "@/lib/referrals/service";

export async function updateReferralRateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!isAdminEmail(user.email, readEnv().adminEmails)) {
    redirect("/admin/referrals?error=denied");
  }

  const rawPercent = String(formData.get("ratePercent") ?? "").trim();
  const percent = Number.parseFloat(rawPercent);
  if (Number.isNaN(percent) || percent < 1 || percent > 50) {
    redirect("/admin/referrals?error=invalid_rate");
  }

  const rateBps = Math.round(percent * 100);
  const result = await updateReferralCommissionRate({
    rateBps,
    actorEmail: user.email,
  });

  if (!result.ok) {
    redirect(`/admin/referrals?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?saved=rate");
}

export async function toggleCommissionHoldAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!isAdminEmail(user.email, readEnv().adminEmails)) {
    redirect("/admin/referrals?error=denied");
  }

  const commissionId = String(formData.get("commissionId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);

  if (!commissionId || (action !== "hold" && action !== "release") || !reason) {
    redirect("/admin/referrals?error=invalid_input");
  }

  const result = await setCommissionHold({
    commissionId,
    action: action as "hold" | "release",
    reason,
    actorEmail: user.email,
  });

  if (!result.ok) {
    redirect(`/admin/referrals?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/admin/referrals");
  revalidatePath("/referrals");
  redirect(`/admin/referrals?saved=${action}`);
}
