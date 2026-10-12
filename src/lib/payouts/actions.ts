"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { createPaystackClient } from "@/lib/paystack/client";
import { paystackKeyMode } from "@/lib/paystack/mode";
import { prepareAdminBatch, releaseAdminBatch } from "@/lib/payouts/admin-batch";
import {
  approveWithdrawal,
  reconcileWithdrawal,
  rejectWithdrawal,
  releaseRejectedTransfer,
  retryWithdrawal,
} from "@/lib/payouts/admin-service";
import { isAdminEmail } from "@/lib/payouts/access";
import { checkBankAccount, saveBankAccount } from "@/lib/payouts/bank";
import { prismaPayouts } from "@/lib/payouts/prisma-repository";
import { manualWithdrawalRefusal } from "@/lib/payouts/manual";
import { createWithdrawalReference } from "@/lib/payouts/reference";
import { prismaAutoPayouts, readSchedule } from "@/lib/payouts/prisma-schedule";
import { formatReward } from "@/lib/rewards/money";

export type PayoutFormState = { error?: string; message?: string; accountName?: string };

const bankSchema = z.object({
  bankCode: z.string().regex(/^\d{3,6}$/),
  accountNumber: z.string().regex(/^\d{10}$/),
});

function clientFromEnv() {
  const env = readEnv();
  if (!env.paystackSecretKey) return null;
  return createPaystackClient({ secretKey: env.paystackSecretKey, baseUrl: env.paystackBaseUrl });
}

function adminOrNull(email: string): boolean {
  return isAdminEmail(email, readEnv().adminEmails);
}

export async function bankAccountAction(_state: PayoutFormState, formData: FormData): Promise<PayoutFormState> {
  const user = await requireUser();
  const client = clientFromEnv();
  if (!client) return { error: "Bank verification is not configured." };
  const parsed = bankSchema.safeParse({
    bankCode: String(formData.get("bankCode") ?? ""),
    accountNumber: String(formData.get("accountNumber") ?? ""),
  });
  if (!parsed.success) return { error: "Enter a supported bank and a 10-digit account number." };
  const intent = String(formData.get("intent") ?? "check");
  if (intent === "save") {
    return saveBankAccount(client, prismaPayouts, {
      userId: user.id,
      bankCode: parsed.data.bankCode,
      accountNumber: parsed.data.accountNumber,
      confirmedName: String(formData.get("confirmedName") ?? ""),
      now: new Date(),
    });
  }
  return checkBankAccount(client, user.id, parsed.data.bankCode, parsed.data.accountNumber);
}

export async function withdrawalAction(state: PayoutFormState, formData: FormData): Promise<PayoutFormState> {
  await requireUser();
  void state;
  void formData;
  return manualWithdrawalRefusal();
}

export async function adminPayoutAction(_state: PayoutFormState, formData: FormData): Promise<PayoutFormState> {
  const user = await requireUser();
  const admin = adminOrNull(user.email);
  if (!admin) return { error: "You do not have access to payout administration." };
  const client = clientFromEnv();
  const intent = String(formData.get("intent") ?? "");
  const id = String(formData.get("withdrawalId") ?? "");
  const env = readEnv();
  const now = new Date();
  revalidatePath("/admin/payouts");
  revalidatePath("/payouts");
  if (intent === "create") return createBatch(user.id, env, now);
  if (intent === "release-batch") return releaseBatch(user.id, env, now, client, formData);
  if (intent === "submit") return { error: "Use Release Batch after reviewing the recipient count and total." };
  if (!id) return { error: "Choose a withdrawal." };
  if (intent === "approve") return approveWithdrawal(prismaPayouts, id, user.id, now);
  if (intent === "reject") return rejectWithdrawal(prismaPayouts, id, user.id, String(formData.get("reason") ?? ""), now);
  if (!client) return { error: "Paystack is not configured." };
  if (intent === "reconcile") return reconcileWithdrawal(prismaPayouts, client, id, user.id, now);
  if (intent === "release") return releaseRejectedTransfer(prismaPayouts, client, id, user.id, now);
  if (intent === "retry") {
    return retryWithdrawal(prismaPayouts, client, {
      id,
      actorId: user.id,
      reference: createWithdrawalReference(2),
      minimumKobo: env.payoutMinKobo,
      currencyCode: env.rewardCurrencyCode,
      at: now,
    });
  }
  return { error: "That payout action is not available." };
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

async function createBatch(actorId: string, env: ReturnType<typeof readEnv>, now: Date): Promise<PayoutFormState> {
  const schedule = await readSchedule(now);
  const result = await prepareAdminBatch({
    admin: true,
    store: prismaAutoPayouts,
    repo: prismaPayouts,
    now,
    currencyCode: env.rewardCurrencyCode,
    minimumKobo: env.payoutMinKobo,
    minUsdCents: schedule.minUsdCents,
    actorId,
    referenceFor: () => createWithdrawalReference(1),
  });
  if (result.status === "enrolled") {
    const total = formatReward(result.totalKobo, "NGN", 100);
    return { message: `Reserved ${result.enrolled} payouts, total ${total}. Review the batch before releasing it. Nothing was sent.` };
  }
  if (result.status === "locked") return { error: "Another payout batch is being created. Try again." };
  if (result.status === "currency") return { error: "Payout batches require an OPN balance." };
  if (result.status === "no_rate") return { error: "Save an unexpired naira rate before creating a batch." };
  if (result.status === "conflict") return { error: "The batch could not be saved. Reserved payouts were not sent. Try again." };
  if (result.status === "forbidden") return { error: "You do not have access to payout administration." };
  return { message: "Nobody is eligible for a new batch." };
}

async function releaseBatch(
  actorId: string,
  env: ReturnType<typeof readEnv>,
  now: Date,
  client: ReturnType<typeof clientFromEnv>,
  formData: FormData,
): Promise<PayoutFormState> {
  const batchId = String(formData.get("batchId") ?? "");
  const confirmCount = Number(formData.get("confirmCount"));
  const confirmKobo = Number(formData.get("confirmKobo"));
  if (!OBJECT_ID.test(batchId) || !Number.isInteger(confirmCount) || !Number.isInteger(confirmKobo)) {
    return { error: "Confirm the recipient count and total before releasing a batch." };
  }
  if (!client) return { error: "Paystack is not configured." };
  const result = await releaseAdminBatch({
    admin: true,
    paused: (await readSchedule(now)).paused,
    repo: prismaPayouts,
    client,
    batchId,
    confirmCount,
    confirmKobo,
    actorId,
    now,
    transfersEnabled: env.paystackTransfersEnabled,
    liveConfirmed: env.paystackLiveConfirmed,
    keyMode: paystackKeyMode(env.paystackSecretKey),
    feeBufferKobo: env.payoutFeeBufferKobo,
  });
  if (!result.ok) return { error: result.message };
  return { message: `Queued ${result.count} transfers. Paystack has not confirmed payment yet.` };
}
