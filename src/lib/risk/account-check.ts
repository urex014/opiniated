import { readEnv } from "@/lib/env";
import { decideRisk, type RiskAssessment } from "@/lib/risk/decide";
import { newCorrelationId } from "@/lib/risk/fingerprint";
import { emailSubject, rememberBank, rememberEmail } from "@/lib/risk/identity";
import { openPayoutReview, saveRiskEvent } from "@/lib/risk/persist";
import { lookupIpReputation } from "@/lib/risk/reputation";
import { signalsFromFacts } from "@/lib/risk/signals";

export async function assessAccount(input: {
  stage: string;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  sharedIp?: boolean;
  emailAlias?: boolean;
  recipientReused?: boolean;
  completionVelocity?: boolean;
  surveyVelocity?: boolean;
  adminBlock?: boolean;
  rateLimited?: boolean;
  now?: Date;
}): Promise<RiskAssessment> {
  const now = input.now ?? new Date();
  const env = readEnv();
  const ip = input.ip && input.ip !== "local" ? input.ip : null;
  const reputation = ip
    ? await lookupIpReputation(ip, { url: env.ipReputationUrl, timeoutMs: env.ipReputationTimeoutMs })
    : "unknown";
  const assessment = decideRisk(
    signalsFromFacts({
      sharedIp: input.sharedIp === true,
      emailAlias: input.emailAlias === true,
      recipientReused: input.recipientReused === true,
      completionVelocity: input.completionVelocity === true,
      surveyVelocity: input.surveyVelocity === true,
      reputation,
      adminBlock: input.adminBlock === true,
      rateLimited: input.rateLimited === true,
    }),
    newCorrelationId(),
    now,
  );
  const subjectHash = input.email ? emailSubject(input.email, env.riskFingerprintKey) : null;
  await saveRiskEvent({
    assessment,
    stage: input.stage,
    userId: input.userId,
    subjectHash,
    now,
    retentionDays: env.riskEventRetentionDays,
  });
  if (input.userId && (assessment.action === "REVIEW" || assessment.action === "BLOCK")) {
    await openPayoutReview({ userId: input.userId, assessment, now }).catch((error: unknown) => {
      console.error("risk review was not opened", { message: error instanceof Error ? error.message : "unknown" });
    });
  }
  return assessment;
}

export async function noteEmailIdentity(userId: string, email: string): Promise<boolean> {
  return rememberEmail(userId, email, readEnv().riskFingerprintKey);
}

export async function noteBankIdentity(
  userId: string,
  account: { bankCode: string; accountLast4: string; accountName: string },
): Promise<boolean> {
  return rememberBank(userId, account, readEnv().riskFingerprintKey);
}
