import { prisma } from "@/lib/db";
import { OPEN_REVIEW_STATUSES, retentionDate } from "@/lib/risk/config";
import type { RiskAssessment } from "@/lib/risk/decide";
import { riskLog } from "@/lib/risk/decide";

export async function saveRiskEvent(input: {
  assessment: RiskAssessment;
  stage: string;
  userId?: string | null;
  subjectHash?: string | null;
  now: Date;
  retentionDays?: number;
}): Promise<void> {
  console.info(riskLog(input.assessment, input.stage));
  try {
    await prisma.riskEvent.create({
      data: {
        correlationId: input.assessment.correlationId,
        userId: input.userId ?? null,
        stage: input.stage,
        score: input.assessment.score,
        level: input.assessment.level,
        action: input.assessment.action,
        signals: input.assessment.signals.join(",").slice(0, 240),
        subjectHash: input.subjectHash ?? null,
        createdAt: input.now,
        expiresAt: retentionDate(input.now, input.retentionDays),
      },
    });
  } catch (error) {
    console.error("risk event was not saved", { message: error instanceof Error ? error.message : "unknown" });
  }
}

export async function openPayoutReview(input: {
  userId: string;
  assessment: RiskAssessment;
  now: Date;
}): Promise<void> {
  if (input.assessment.action !== "REVIEW" && input.assessment.action !== "BLOCK" && input.assessment.action !== "RESTRICT") {
    return;
  }
  const existing = await prisma.riskReview.findFirst({
    where: { userId: input.userId, status: { in: [...OPEN_REVIEW_STATUSES] } },
  });
  if (existing) return;
  await prisma.riskReview.create({
    data: {
      userId: input.userId,
      status: "OPEN",
      scope: "payout",
      score: input.assessment.score,
      level: input.assessment.level,
      signals: input.assessment.signals.join(",").slice(0, 240),
      correlationId: input.assessment.correlationId,
      createdAt: input.now,
    },
  });
}

export async function payoutHeld(userId: string): Promise<boolean> {
  const row = await prisma.riskReview.findFirst({
    where: { userId, status: { in: [...OPEN_REVIEW_STATUSES] } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function surveyRestricted(userId: string): Promise<boolean> {
  const row = await prisma.riskReview.findFirst({
    where: { userId, status: { in: ["RESTRICTED", "ESCALATED"] }, scope: { in: ["survey", "account"] } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function openReviewUserIds(): Promise<string[]> {
  const rows = await prisma.riskReview.findMany({
    where: { status: { in: [...OPEN_REVIEW_STATUSES] } },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

export async function heldUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.riskReview.findMany({
    where: { userId: { in: userIds }, status: { in: [...OPEN_REVIEW_STATUSES] } },
    select: { userId: true },
  });
  return new Set(rows.map((row) => row.userId));
}
