export type ReviewIntent = "release" | "restrict" | "escalate";

export type ReviewDecision = {
  action: ReviewIntent;
  status: "RELEASED" | "RESTRICTED" | "ESCALATED";
  scope: "payout" | "survey" | "account";
};

/** Maps an admin intent to the stored status. The server action records this as an audit row. */
export function reviewDecision(intent: string): ReviewDecision | null {
  if (intent === "release") return { action: "release", status: "RELEASED", scope: "payout" };
  if (intent === "restrict") return { action: "restrict", status: "RESTRICTED", scope: "survey" };
  if (intent === "escalate") return { action: "escalate", status: "ESCALATED", scope: "account" };
  return null;
}
