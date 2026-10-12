import { rateLimitStore } from "@/lib/risk/store";

export async function allowBankResolve(userId: string, now = Date.now()): Promise<boolean> {
  const result = await rateLimitStore().consume(`payout:resolve:${userId}`, 8, 15 * 60 * 1000, now);
  return result.allowed;
}

export async function allowRecipientCreate(userId: string, now = Date.now()): Promise<boolean> {
  const result = await rateLimitStore().consume(`payout:recipient:${userId}`, 5, 60 * 60 * 1000, now);
  return result.allowed;
}
