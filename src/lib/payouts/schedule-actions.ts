"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/payouts/access";
import type { PayoutFormState } from "@/lib/payouts/actions";
import { saveFxPolicy, saveScheduleSettings, setSchedulePaused } from "@/lib/payouts/prisma-schedule";

export async function adminScheduleAction(_state: PayoutFormState, formData: FormData): Promise<PayoutFormState> {
  const user = await requireUser();
  if (!isAdminEmail(user.email, readEnv().adminEmails)) return { error: "You do not have access to payout administration." };
  const intent = String(formData.get("intent") ?? "");
  const now = new Date();
  if (intent === "pause") {
    await setSchedulePaused(true, user.id);
    return { message: "New batch submissions are paused." };
  }
  if (intent === "resume") {
    await setSchedulePaused(false, user.id);
    return { message: "Scheduled batches can run again. Paystack transfers still follow the server switch." };
  }
  if (intent === "settings") {
    const intervalDays = z.coerce.number().int().safeParse(formData.get("intervalDays"));
    const minUsdCents = z.coerce.number().int().safeParse(formData.get("minUsdCents"));
    if (!intervalDays.success || !minUsdCents.success) return { error: "Enter whole numbers for the schedule." };
    return saveScheduleSettings({ intervalDays: intervalDays.data, minUsdCents: minUsdCents.data, actorId: user.id });
  }
  if (intent === "fx") {
    const nairaPerUsd = z.coerce.number().int().safeParse(formData.get("nairaPerUsd"));
    const validForDays = z.coerce.number().int().safeParse(formData.get("validForDays"));
    if (!nairaPerUsd.success || !validForDays.success) return { error: "Enter a whole naira rate and a whole number of days." };
    return saveFxPolicy({
      nairaPerUsd: nairaPerUsd.data,
      validForDays: validForDays.data,
      note: String(formData.get("note") ?? ""),
      actorId: user.id,
      now,
    });
  }
  return { error: "That schedule action is not available." };
}
