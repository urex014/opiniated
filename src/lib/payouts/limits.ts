import { rateLimit } from "@/lib/security/rate-limit";

export function allowBankResolve(userId: string, now = Date.now()): boolean {
  return rateLimit(`payout:resolve:${userId}`, 8, 15 * 60 * 1000, now);
}

export function allowRecipientCreate(userId: string, now = Date.now()): boolean {
  return rateLimit(`payout:recipient:${userId}`, 5, 60 * 60 * 1000, now);
}
