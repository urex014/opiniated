import { describe, expect, it } from "vitest";
import { calculateReferralSplit } from "@/lib/referrals/math";

describe("calculateReferralSplit", () => {
  it("matches the exact $1.00 survey example from specifications", () => {
    // Confirmed survey worth $1 gross:
    // Survey user earns $0.40 (40 units).
    // Opiniated gross share is $0.60 (60 units).
    // Referrer earns 10% of $0.60 = $0.06 (6 units).
    // Opiniated retains $0.54 (54 units).
    const split = calculateReferralSplit({
      userRewardUnits: 40,
      providerUsd: "0.60",
      minorUnitFactor: 100,
      commissionRateBps: 1000,
    });

    expect(split).toEqual({
      userRewardUnits: 40,
      opiniatedShareUnits: 60,
      commissionUnits: 6,
      retainedUnits: 54,
      commissionRateBps: 1000,
      grossAmountUsd: "0.60",
    });
  });

  it("calculates 40%/60% split accurately when providerUsd is omitted", () => {
    const split = calculateReferralSplit({
      userRewardUnits: 40,
      commissionRateBps: 1000,
    });

    expect(split).toEqual({
      userRewardUnits: 40,
      opiniatedShareUnits: 60,
      commissionUnits: 6,
      retainedUnits: 54,
      commissionRateBps: 1000,
      grossAmountUsd: null,
    });
  });

  it("handles custom configurable admin rates (e.g. 15% / 1500 bps)", () => {
    const split = calculateReferralSplit({
      userRewardUnits: 40,
      providerUsd: "0.60",
      commissionRateBps: 1500, // 15% of 60 = 9 units
    });

    expect(split?.commissionUnits).toBe(9);
    expect(split?.retainedUnits).toBe(51);
  });

  it("floors fractional minor units to prevent overpaying", () => {
    // 75 units user reward -> Opiniated share = floor(75 * 1.5) = 112 units
    // Commission = floor(112 * 0.10) = floor(11.2) = 11 units
    // Retained = 112 - 11 = 101 units
    const split = calculateReferralSplit({
      userRewardUnits: 75,
      commissionRateBps: 1000,
    });

    expect(split?.opiniatedShareUnits).toBe(112);
    expect(split?.commissionUnits).toBe(11);
    expect(split?.retainedUnits).toBe(101);
  });

  it("returns null for non-positive user rewards", () => {
    expect(calculateReferralSplit({ userRewardUnits: 0 })).toBeNull();
    expect(calculateReferralSplit({ userRewardUnits: -10 })).toBeNull();
  });

  it("returns null for invalid commission rates", () => {
    expect(calculateReferralSplit({ userRewardUnits: 40, commissionRateBps: -1 })).toBeNull();
    expect(calculateReferralSplit({ userRewardUnits: 40, commissionRateBps: 10001 })).toBeNull();
  });
});
