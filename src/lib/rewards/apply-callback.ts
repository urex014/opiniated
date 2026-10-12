import type { PostbackOutcome, RewardStore, ValidatedCallback } from "@/lib/rewards/types";

export type AppliedCallback = {
  httpStatus: number;
  outcome: PostbackOutcome;
};

/** Persist a callback that the provider adapter has already authenticated. */
export async function applyValidatedCallback(store: RewardStore, event: ValidatedCallback): Promise<AppliedCallback> {
  const result = await store.apply(event);
  if (result.outcome === "ACCEPTED") return { httpStatus: 200, outcome: "ACCEPTED" };
  if (result.outcome === "DUPLICATE") return { httpStatus: 200, outcome: "DUPLICATE" };
  if (result.outcome === "UNKNOWN_USER") return { httpStatus: 200, outcome: "UNKNOWN_USER" };
  return { httpStatus: 200, outcome: "UNSUPPORTED_EVENT" };
}
