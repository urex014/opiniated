import { parseRewardUnits } from "@/lib/rewards/money";
import {
  DEFAULT_COMMISSION_RATE_BPS,
  OPINIATED_REVENUE_SHARE_PERCENT,
  USER_REVENUE_SHARE_PERCENT,
} from "@/lib/referrals/constants";

export type CommissionSplit = {
  userRewardUnits: number;
  opiniatedShareUnits: number;
  commissionUnits: number;
  retainedUnits: number;
  commissionRateBps: number;
  grossAmountUsd: string | null;
};

/**
 * Calculates the revenue split and referral commission in integer minor units (OPN).
 *
 * Explicit rounding rules:
 * - Integer arithmetic is used throughout (no floating-point drift).
 * - Fractional minor units for commissions are rounded down (Math.floor)
 *   to ensure the platform never overpays fractional units.
 * - Opiniated retained share is strictly (opiniatedShareUnits - commissionUnits),
 *   preserving conservation of units.
 */
export function calculateReferralSplit(input: {
  userRewardUnits: number;
  providerUsd?: string | null;
  minorUnitFactor?: number;
  commissionRateBps?: number;
}): CommissionSplit | null {
  const userRewardUnits = Math.trunc(input.userRewardUnits);
  if (userRewardUnits <= 0) return null;

  const rateBps = input.commissionRateBps ?? DEFAULT_COMMISSION_RATE_BPS;
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) return null;

  const factor = input.minorUnitFactor ?? 100;

  let opiniatedShareUnits: number;
  let parsedProviderUsdUnits: number | null = null;
  if (input.providerUsd) {
    parsedProviderUsdUnits = parseRewardUnits(input.providerUsd, factor);
  }

  if (parsedProviderUsdUnits !== null && parsedProviderUsdUnits > 0) {
    opiniatedShareUnits = parsedProviderUsdUnits;
  } else {
    opiniatedShareUnits = Math.floor(
      (userRewardUnits * OPINIATED_REVENUE_SHARE_PERCENT) / USER_REVENUE_SHARE_PERCENT,
    );
  }

  const commissionUnits = Math.floor((opiniatedShareUnits * rateBps) / 10000);
  const retainedUnits = opiniatedShareUnits - commissionUnits;

  return {
    userRewardUnits,
    opiniatedShareUnits,
    commissionUnits,
    retainedUnits,
    commissionRateBps: rateBps,
    grossAmountUsd: input.providerUsd ?? null,
  };
}
