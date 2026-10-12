const DAY_MS = 24 * 60 * 60 * 1000;

export const FULL_BALANCE_FLAG = "This withdrawal takes the full available balance.";
export const NEW_ACCOUNT_FLAG = "Bank account was saved in the last 24 hours.";
export const FIRST_WITHDRAWAL_FLAG = "This is the first withdrawal for the account.";

export function riskFlags(input: {
  points: number;
  spendableBefore: number;
  accountUpdatedAt: Date | null;
  paidCount: number;
  now: Date;
}): string[] {
  const flags: string[] = [];
  if (input.accountUpdatedAt && input.now.getTime() - input.accountUpdatedAt.getTime() < DAY_MS) {
    flags.push(NEW_ACCOUNT_FLAG);
  }
  if (input.points === input.spendableBefore) flags.push(FULL_BALANCE_FLAG);
  if (input.paidCount === 0) flags.push(FIRST_WITHDRAWAL_FLAG);
  return flags;
}

export function openingStatus(flags: string[]): "PENDING" | "UNDER_REVIEW" {
  if (flags.includes(NEW_ACCOUNT_FLAG) || flags.includes(FULL_BALANCE_FLAG)) return "UNDER_REVIEW";
  return "PENDING";
}
