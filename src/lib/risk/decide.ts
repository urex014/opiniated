import { RISK_BANDS } from "@/lib/risk/config";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskAction = "ALLOW" | "MONITOR" | "CHALLENGE" | "RESTRICT" | "REVIEW" | "BLOCK";
export type HardAction = "RESTRICT" | "REVIEW" | "BLOCK";

export type RiskSignal = {
  code: string;
  weight: number;
  hard?: HardAction;
};

export type RiskAssessment = {
  score: number;
  level: RiskLevel;
  signals: string[];
  action: RiskAction;
  at: string;
  correlationId: string;
};

const RANK: Record<RiskAction, number> = {
  ALLOW: 0,
  MONITOR: 1,
  CHALLENGE: 2,
  RESTRICT: 3,
  REVIEW: 4,
  BLOCK: 5,
};

export function decideRisk(signals: RiskSignal[], correlationId: string, now = new Date()): RiskAssessment {
  const score = clamp(signals.reduce((total, signal) => total + Math.max(0, signal.weight), 0));
  let action = actionForScore(score);
  for (const signal of signals) {
    if (signal.hard && RANK[signal.hard] > RANK[action]) action = signal.hard;
  }
  if (action === "BLOCK" && !signals.some((signal) => signal.hard === "BLOCK")) action = "REVIEW";
  return {
    score,
    level: levelForScore(score),
    signals: signals.map((signal) => signal.code),
    action,
    at: now.toISOString(),
    correlationId,
  };
}

function actionForScore(score: number): RiskAction {
  if (score >= RISK_BANDS.review) return "REVIEW";
  if (score >= RISK_BANDS.challenge) return "CHALLENGE";
  if (score >= RISK_BANDS.monitor) return "MONITOR";
  return "ALLOW";
}

function levelForScore(score: number): RiskLevel {
  if (score >= 85) return "CRITICAL";
  if (score >= RISK_BANDS.review) return "HIGH";
  if (score >= RISK_BANDS.monitor) return "MEDIUM";
  return "LOW";
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Log line safe to print. It has no address, secret, or fingerprint. */
export function riskLog(assessment: RiskAssessment, stage: string): string {
  return JSON.stringify({
    type: "risk",
    stage,
    correlationId: assessment.correlationId,
    action: assessment.action,
    level: assessment.level,
    score: assessment.score,
    signals: assessment.signals,
  });
}
