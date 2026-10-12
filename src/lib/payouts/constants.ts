export const LEDGER_PROVIDER = "opiniated";
export const BATCH_LIMIT = 100;
export const BATCH_GAP_MS = 5_000;

export const WITHDRAWAL_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REJECTED",
  "REVERSED",
] as const;

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const OPEN_WITHDRAWAL_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING"] as const;

export function isWithdrawalStatus(value: string): value is WithdrawalStatus {
  return (WITHDRAWAL_STATUSES as readonly string[]).includes(value);
}
