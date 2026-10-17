"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { hasClaimedTask, claimTask, type ClaimTaskResult } from "@/lib/tasks/service";
import { TELEGRAM_TASK_ID } from "@/lib/tasks/constants";
import { generateTelegramVerificationPayload } from "@/lib/tasks/telegram-token";

export async function getTelegramVerificationLinkAction(): Promise<{
  ok: boolean;
  link?: string;
  botUsername?: string;
  error?: string;
}> {
  const user = await requireUser();
  const env = readEnv();
  const botUsername = env.telegramBotUsername ?? "updatedadminbot";

  const isClaimed = await hasClaimedTask(user.id, TELEGRAM_TASK_ID);
  if (isClaimed) {
    return { ok: false, error: "Task already completed" };
  }

  const payload = generateTelegramVerificationPayload(user.id);
  const link = `https://t.me/${botUsername}?start=${payload}`;

  return { ok: true, link, botUsername };
}

export async function checkTelegramTaskStatusAction(): Promise<{
  isClaimed: boolean;
}> {
  const user = await requireUser();
  const isClaimed = await hasClaimedTask(user.id, TELEGRAM_TASK_ID);
  if (isClaimed) {
    revalidatePath("/dashboard");
    revalidatePath("/activity");
  }
  return { isClaimed };
}

export async function claimTelegramTaskAction(): Promise<ClaimTaskResult> {
  const user = await requireUser();
  const result = await claimTask(user.id, TELEGRAM_TASK_ID);

  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/activity");
  }

  return result;
}
