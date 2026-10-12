export function rewardUnitName(code: string): string {
  if (code === "PTS" || code === "OPN") return "Opiniated Points";
  return code;
}

/**
 * Describe the configured ledger unit. PTS with factor 1 has no cash conversion.
 * An ISO code with a minor-unit factor uses that factor as the only conversion.
 */
export function rewardUnitExplanation(code: string, factor: number): string {
  if (code === "OPN") {
    return "OPN is the in-app balance. 100 OPN equal $1.00, so one OPN is one cent. Rewards are stored as whole OPN and are added only after a verified provider callback. A verified bank account is paid automatically once the available balance reaches the minimum. The naira amount uses the whole-naira price per dollar recorded on that payout. Paystack marks it paid only after the transfer succeeds.";
  }
  if (code === "PTS" && factor === 1) {
    return "Opiniated Points (PTS) are the in-app balance. One point is one integer unit. Points are added only after a verified provider callback. A point has no naira value until the operator sets an integer kobo-per-point rate. A withdrawal is paid only after review and a confirmed Paystack transfer.";
  }
  if (factor === 1) {
    return `Rewards are stored as whole ${code} units. A unit is credited only after a verified provider callback. A withdrawal is paid only after review and a confirmed Paystack transfer.`;
  }
  const places = String(factor).length - 1;
  return `Rewards are stored as integer minor units of ${code}. ${factor} units equal 1 ${code}, shown with ${places} decimal places. A balance is credited only after a verified provider callback. A displayed balance is not itself a completed payout.`;
}
