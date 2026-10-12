const SETTLED = new Set(["PAID", "REVERSED"]);
const UNSENT = new Set(["FAILED", "REJECTED"]);

/** Returns the next batch status once every member is terminal, otherwise null. */
export function deriveBatchStatus(statuses: string[], current: string): string | null {
  if (statuses.length === 0) return null;
  if (statuses.some((status) => !SETTLED.has(status) && !UNSENT.has(status))) return null;
  const failed = statuses.filter((status) => UNSENT.has(status)).length;
  let next = "PARTIALLY_COMPLETED";
  if (failed === 0) next = "COMPLETED";
  else if (failed === statuses.length) next = current === "PENDING" || current === "PREPARING" ? "CANCELLED" : "FAILED";
  return next === current ? null : next;
}
