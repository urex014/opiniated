"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { createPaystackClient } from "@/lib/paystack/client";
import { paystackKeyMode } from "@/lib/paystack/mode";
import {
  approveWithdrawal,
  reconcileWithdrawal,
  rejectWithdrawal,
  releaseRejectedTransfer,
  retryWithdrawal,
  submitBatch,
} from "@/lib/payouts/admin-service";
import { isAdminEmail } from "@/lib/payouts/access";
import { checkBankAccount, saveBankAccount } from "@/lib/payouts/bank";
import { prismaPayouts } from "@/lib/payouts/prisma-repository";
import { manualWithdrawalRefusal } from "@/lib/payouts/manual";
import { createWithdrawalReference } from "@/lib/payouts/reference";
import { readSchedule } from "@/lib/payouts/prisma-schedule";

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
  if (!adminOrNull(user.email)) return { error: "You do not have access to payout administration." };
  const client = clientFromEnv();
  const intent = String(formData.get("intent") ?? "");
  const id = String(formData.get("withdrawalId") ?? "");
  const env = readEnv();
  const now = new Date();
  if (intent === "submit") {
    if ((await readSchedule(now)).paused) return { error: "Batch submission is paused." };
    if (!client) return { error: "Paystack is not configured." };
    const result = await submitBatch({
      repo: prismaPayouts,
      client,
      actorId: user.id,
      now,
      transfersEnabled: env.paystackTransfersEnabled,
      liveConfirmed: env.paystackLiveConfirmed,
      keyMode: paystackKeyMode(env.paystackSecretKey),
      feeBufferKobo: env.payoutFeeBufferKobo,
    });
    return result.ok ? { message: `Queued ${result.count} transfers. They are not paid yet.` } : { error: result.message };
  }
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
