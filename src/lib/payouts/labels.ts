import type { WithdrawalStatus } from "@/lib/payouts/constants";

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
