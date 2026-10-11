export function rewardUnitName(code: string): string {
  return code === "PTS" ? "Opiniated Points" : code;
}

/**
 * Describe the configured ledger unit. PTS with factor 1 has no cash conversion.
 * An ISO code with a minor-unit factor uses that factor as the only conversion.
 */
export function rewardUnitExplanation(code: string, factor: number): string {
  if (code === "PTS" && factor === 1) {
    return "Opiniated Points (PTS) are the in-app balance. One point is one integer unit. Points are added only after a verified provider callback. This installation does not set a cash conversion rate, and points cannot be withdrawn.";
  }
  if (factor === 1) {
    return `Rewards are stored as whole ${code} units. A unit is credited only after a verified provider callback. This installation does not pay that balance out.`;
  }
  const places = String(factor).length - 1;
  return `Rewards are stored as integer minor units of ${code}. ${factor} units equal 1 ${code}, shown with ${places} decimal places. A balance is credited only after a verified provider callback and is not a withdrawal.`;
}
