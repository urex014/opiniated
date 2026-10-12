import { RISK_WEIGHTS } from "@/lib/risk/config";
import type { RiskSignal } from "@/lib/risk/decide";
import type { Reputation } from "@/lib/risk/reputation";

export function signalsFromFacts(facts: {
  sharedIp: boolean;
  emailAlias: boolean;
  recipientReused: boolean;
  completionVelocity: boolean;
  surveyVelocity: boolean;
  reputation: Reputation;
  adminBlock: boolean;
  rateLimited: boolean;
}): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (facts.sharedIp) signals.push({ code: "shared_ip", weight: RISK_WEIGHTS.sharedIp });
  if (facts.emailAlias) signals.push({ code: "email_alias", weight: RISK_WEIGHTS.emailAlias, hard: "REVIEW" });
  if (facts.recipientReused) signals.push({ code: "payout_recipient_reused", weight: RISK_WEIGHTS.recipientReused, hard: "REVIEW" });
  if (facts.completionVelocity) signals.push({ code: "completion_velocity", weight: RISK_WEIGHTS.completionVelocity, hard: "REVIEW" });
  if (facts.surveyVelocity) signals.push({ code: "survey_velocity", weight: RISK_WEIGHTS.surveyVelocity });
  if (facts.reputation === "malicious") {
    signals.push({ code: "reputation_malicious", weight: RISK_WEIGHTS.maliciousNetwork, hard: "REVIEW" });
  }
  if (facts.adminBlock) signals.push({ code: "admin_block", weight: 100, hard: "BLOCK" });
  if (facts.rateLimited) signals.push({ code: "rate_limited", weight: 0, hard: "RESTRICT" });
  return signals;
}
