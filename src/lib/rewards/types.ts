export type PostbackOutcome =
  | "ACCEPTED"
  | "DUPLICATE"
  | "INVALID_SIGNATURE"
  | "INVALID_PAYLOAD"
  | "UNKNOWN_USER"
  | "UNSUPPORTED_EVENT"
  | "INTERNAL_FAILURE";

export type CallbackType = "COMPLETE" | "START_BONUS" | "RECONCILIATION" | "SCREENOUT";

export type ValidatedCallback = {
  provider: string;
  userId: string;
  providerTxId: string;
  type: CallbackType;
  amountUnits: number;
  currencyCode: string;
  surveyId: string | null;
  refTxId: string | null;
  reason: string | null;
  providerUsd: string | null;
  disposition: "reward" | "unsupported";
};

export type ApplyResult =
  | { outcome: "ACCEPTED"; availableUnits: number }
  | { outcome: "DUPLICATE" }
  | { outcome: "UNKNOWN_USER" }
  | { outcome: "UNSUPPORTED_EVENT" };

export interface RewardStore {
  apply(event: ValidatedCallback): Promise<ApplyResult>;
  recordRejection(entry: {
    provider: string;
    outcome: "INVALID_SIGNATURE" | "INVALID_PAYLOAD";
    providerTxId?: string;
    type?: string;
    userId?: string;
  }): Promise<void>;
}
