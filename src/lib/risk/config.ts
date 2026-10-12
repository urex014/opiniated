/** Bands choose a default action. A hard rule can still raise it. Score is not proof of fraud. */
export const RISK_BANDS = { monitor: 30, challenge: 50, review: 70 } as const;

export const RISK_WEIGHTS = {
  sharedIp: 5,
  emailAlias: 20,
  recipientReused: 35,
  completionVelocity: 30,
  surveyVelocity: 15,
  maliciousNetwork: 40,
} as const;

/** Completions in one hour that open a payout review. The callback is still credited. */
export const COMPLETION_VELOCITY_LIMIT = 15;

/** Survey starts in ten minutes that are recorded, before the launch rate limit. */
export const SURVEY_VELOCITY_LIMIT = 15;

export const RISK_EVENT_RETENTION_DAYS = 30;

/**
 * An open payout review is not auto-released when this period ends.
 * It is the operator response target. Support can ask for the hold to be checked.
 */
export const RISK_REVIEW_TARGET_DAYS = 14;

export const OPEN_REVIEW_STATUSES = ["OPEN", "RESTRICTED", "ESCALATED"] as const;

export function retentionDate(now: Date, days = RISK_EVENT_RETENTION_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
