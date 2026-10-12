import type { PaystackClient } from "@/lib/paystack/client";
import { allowBankResolve, allowRecipientCreate } from "@/lib/payouts/limits";
import type { PayoutRepository } from "@/lib/payouts/repository";

const ACCOUNT_NUMBER = /^\d{10}$/;
const BANK_CODE = /^\d{3,6}$/;

export type BankFlowResult = { error?: string; message?: string; accountName?: string };

export async function checkBankAccount(
  client: PaystackClient,
  userId: string,
  bankCode: string,
  accountNumber: string,
): Promise<BankFlowResult> {
  if (!BANK_CODE.test(bankCode)) return { error: "Choose a supported bank." };
  if (!ACCOUNT_NUMBER.test(accountNumber)) return { error: "Enter the 10-digit account number." };
  if (!allowBankResolve(userId)) return { error: "Too many account checks. Wait a few minutes and try again." };
  const banks = await client.listBanks();
  if (!banks.ok) return { error: banks.message };
  if (!banks.banks.some((bank) => bank.code === bankCode)) return { error: "Choose a supported bank." };
  const resolved = await client.resolveAccount(accountNumber, bankCode);
  if (!resolved.ok) return { error: resolved.message };
  return {
    message: ` ${resolved.accountName}. Save the account only if that name is yours.`,
    accountName: resolved.accountName,
  };
}

export async function saveBankAccount(
  client: PaystackClient,
  repo: PayoutRepository,
  input: { userId: string; bankCode: string; accountNumber: string; confirmedName: string; now: Date },
): Promise<BankFlowResult> {
  if (!BANK_CODE.test(input.bankCode)) return { error: "Choose a supported bank." };
  if (!ACCOUNT_NUMBER.test(input.accountNumber)) return { error: "Enter the 10-digit account number." };
  if (!input.confirmedName.trim()) return { error: "Check the account before saving it." };
  if (!allowBankResolve(input.userId) || !allowRecipientCreate(input.userId)) {
    return { error: "Too many account saves. Wait and try again." };
  }
  const banks = await client.listBanks();
  if (!banks.ok) return { error: banks.message };
  const bank = banks.banks.find((item) => item.code === input.bankCode);
  if (!bank) return { error: "Choose a supported bank." };
  const resolved = await client.resolveAccount(input.accountNumber, input.bankCode);
  if (!resolved.ok) return { error: resolved.message };
  if (resolved.accountName.trim().toLowerCase() !== input.confirmedName.trim().toLowerCase()) {
    return { error: "The account name changed. Check the account again before saving it." };
  }
  const last4 = input.accountNumber.slice(-4);
  const existing = await repo.getPayoutAccount(input.userId);
  if (
    existing &&
    existing.bankCode === bank.code &&
    existing.accountLast4 === last4 &&
    existing.accountName.trim().toLowerCase() === resolved.accountName.trim().toLowerCase()
  ) {
    return { message: `Saved ${bank.name} account ending ${last4} for ${resolved.accountName}.` };
  }
  const recipient = await client.createRecipient({
    name: resolved.accountName,
    accountNumber: input.accountNumber,
    bankCode: input.bankCode,
  });
  if (!recipient.ok) return { error: recipient.message };
  const saved = await repo.savePayoutAccount({
    userId: input.userId,
    bankCode: bank.code,
    bankName: bank.name,
    accountLast4: last4,
    accountName: resolved.accountName,
    recipientCode: recipient.recipientCode,
    updatedAt: input.now,
  });
  if (!saved.ok) return { error: "That payout account is already saved on another profile." };
  return { message: `Saved ${bank.name} account ending ${last4} for ${resolved.accountName}.` };
}
