import type { WithdrawalStatus } from "@/lib/payouts/constants";

export type PayoutAccountSnapshot = {
  userId: string;
  bankCode: string;
  bankName: string;
  accountLast4: string;
  accountName: string;
  recipientCode: string;
  updatedAt: Date;
};

export type AttemptSnapshot = {
  reference: string;
  status: string;
  transferCode: string | null;
  createdAt: Date;
};

export type WithdrawalSnapshot = {
  id: string;
  userId: string;
  userEmail: string;
  points: number;
  amountKobo: number;
  currency: string;
  recipientCode: string;
  reference: string;
  status: WithdrawalStatus;
  failureReason: string | null;
  transferCode: string | null;
  batchId: string | null;
  batchStatus: string | null;
  attempt: number;
  anomaly: string | null;
  nairaPerUsd: number | null;
  rateAt: Date | null;
  usdCents: number | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  processingAt: Date | null;
  completedAt: Date | null;
  bankName: string | null;
  accountLast4: string | null;
  accountName: string | null;
  accountUpdatedAt: Date | null;
  availableUnits: number;
  reservedUnits: number;
  attempts: AttemptSnapshot[];
};

export type RequestWithdrawalResult =
  | { ok: true; withdrawal: WithdrawalSnapshot }
  | { ok: false; code: "no_account" | "below_minimum" | "open_withdrawal" | "insufficient" | "invalid_amount" | "duplicate_reference" | "conflict" };

export type ReviewResult = { ok: true; status: WithdrawalStatus } | { ok: false; code: "missing" | "not_allowed" | "conflict" };

export type SettleResult = "paid" | "failed" | "reversed" | "ignored" | "anomaly";

export type RetryResult = { ok: true; reference: string } | { ok: false; code: "missing" | "not_failed" | "no_account" | "insufficient" | "open_withdrawal" | "duplicate_reference" | "conflict" };

export interface PayoutRepository {
  getBalance(userId: string): Promise<{ availableUnits: number; reservedUnits: number; lifetimeCreditedUnits: number } | null>;
  getPayoutAccount(userId: string): Promise<PayoutAccountSnapshot | null>;
  savePayoutAccount(input: PayoutAccountSnapshot): Promise<{ ok: true } | { ok: false; code: "recipient_taken" }>;
  requestWithdrawal(input: {
    userId: string;
    points: number;
    amountKobo: number;
    minimumKobo: number;
    reference: string;
    status: "PENDING" | "UNDER_REVIEW" | "APPROVED";
    currencyCode: string;
    at: Date;
    nairaPerUsd?: number | null;
    rateAt?: Date | null;
    usdCents?: number | null;
  }): Promise<RequestWithdrawalResult>;
  listForUser(userId: string): Promise<WithdrawalSnapshot[]>;
  listRecent(limit: number): Promise<WithdrawalSnapshot[]>;
  getById(id: string): Promise<WithdrawalSnapshot | null>;
  getByReference(reference: string): Promise<WithdrawalSnapshot | null>;
  countPaid(userId: string): Promise<number>;
  review(input: { id: string; actorId: string; decision: "approve" | "reject"; reason: string | null; at: Date }): Promise<ReviewResult>;
  listApproved(limit: number): Promise<WithdrawalSnapshot[]>;
  tryAdvanceGate(now: Date, gapMs: number): Promise<boolean>;
  claimApproved(ids: string[], at: Date): Promise<WithdrawalSnapshot[]>;
  createBatch(input: { actorId: string; transferCount: number; message: string | null; submittedAt: Date; withdrawalIds: string[] }): Promise<{ id: string }>;
  createPendingBatch(input: {
    transferCount: number;
    totalPoints: number;
    totalKobo: number;
    nairaPerUsd: number | null;
    rateAt: Date | null;
    withdrawalIds: string[];
  }): Promise<{ ok: true; id: string } | { ok: false; code: "conflict" }>;
  oldestPendingBatch(): Promise<{ id: string; withdrawalIds: string[] } | null>;
  detachUnclaimed(batchId: string, claimedIds: string[]): Promise<void>;
  updateBatch(id: string, input: { status: string; message: string | null; submittedAt?: Date }): Promise<void>;
  setTransferCode(reference: string, transferCode: string): Promise<void>;
  settle(input: {
    reference: string;
    verified: "success" | "failed" | "reversed";
    amountKobo: number | null;
    currency: string | null;
    transferCode: string | null;
    at: Date;
  }): Promise<SettleResult>;
  releaseUnsent(input: { reference: string; at: Date; reason: string }): Promise<SettleResult>;
  beginRetry(input: {
    withdrawalId: string;
    actorId: string;
    reference: string;
    minimumKobo: number;
    currencyCode: string;
    at: Date;
  }): Promise<RetryResult>;
  setAnomaly(withdrawalId: string, anomaly: string): Promise<void>;
  findEvent(eventKey: string): Promise<{ processedAt: Date | null } | null>;
  createEvent(input: { eventKey: string; event: string; reference: string | null }): Promise<"created" | "exists">;
  markEventProcessed(eventKey: string, note: string | null): Promise<void>;
  recordAudit(input: { actorId: string | null; action: string; withdrawalId?: string; batchId?: string; detail?: string }): Promise<void>;
}
