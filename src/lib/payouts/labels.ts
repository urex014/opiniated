import type { WithdrawalStatus } from "@/lib/payouts/constants";
import type { EligibilityReason } from "@/lib/payouts/eligibility";

export function withdrawalStatusLabel(status: WithdrawalStatus): string {
  if (status === "PENDING") return "Pending review";
  if (status === "UNDER_REVIEW") return "Under review";
  if (status === "APPROVED") return "Scheduled";
  if (status === "PROCESSING") return "Processing";
  if (status === "PAID") return "Paid";
  if (status === "FAILED") return "Failed";
  if (status === "REJECTED") return "Rejected";
  return "Reversed";
}

export function eligibilityLabel(reason: EligibilityReason): string {
  if (reason === "below_threshold") return "Below the minimum balance";
  if (reason === "payout_review") return "Payout hold";
  if (reason === "bank_recent") return "24-hour bank hold";
  if (reason === "open_withdrawal") return "Already reserved";
  if (reason === "no_bank") return "No verified bank account";
  if (reason === "no_rate") return "No unexpired naira rate";
  if (reason === "rate_expired") return "Naira rate expired";
  if (reason === "below_paystack_min") return "Below the Paystack minimum";
  if (reason === "above_paystack_max") return "Above the transfer maximum";
  if (reason === "deleted") return "Account deleted";
  if (reason === "currency") return "Balance is not OPN";
  return "Not eligible";
}

export function withdrawalNextStep(status: WithdrawalStatus, failureReason: string | null): string {
  if (status === "PENDING" || status === "UNDER_REVIEW") {
    return "The points are reserved. This request is not a payment. It waits for review.";
  }
  if (status === "APPROVED") return "Your payout has been included in an upcoming batch.";
  if (status === "PROCESSING") return "Your payout is being processed.";
  if (status === "PAID") return "Your payout has been completed.";
  if (status === "FAILED") {
    return failureReason
      ? `${failureReason} The reserved points are available again.`
      : "The transfer did not complete. The reserved points are available again.";
  }
  if (status === "REJECTED") return "The request was rejected. The reserved points are available again.";
  return "Paystack reversed this transfer. The points were returned to the available balance once.";
}
