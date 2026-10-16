import { describe, expect, it } from "vitest";
import { evaluateEligibility, type EligibilityInput } from "@/lib/payouts/eligibility";

describe("referral earnings payout integration", () => {
  const baseInput: EligibilityInput = {
    deletedAt: null,
    availableUnits: 0,
    reservedUnits: 0,
    accountUpdatedAt: new Date(Date.now() - 48 * 3600 * 1000), // bank verified 48h ago
    recipientCode: "RCP_1234567890",
    openWithdrawal: false,
    currencyCode: "OPN",
    nairaPerUsd: 1500,
    rateExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    now: new Date(),
    minUsdCents: 500, // $5.00 minimum
    minimumKobo: 10000,
    payoutHeld: false,
  };

  it("is below threshold when referral earnings are under 500 OPN ($5.00)", () => {
    // Referrer earned 300 OPN from referrals so far
    const input: EligibilityInput = {
      ...baseInput,
      availableUnits: 300,
      reservedUnits: 0,
    };

    const result = evaluateEligibility(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("below_threshold");
    }
  });

  it("qualifies for payout once referral earnings reach the minimum threshold", () => {
    // Referrer earned 600 OPN total
    const input: EligibilityInput = {
      ...baseInput,
      availableUnits: 600,
      reservedUnits: 0,
    };

    const result = evaluateEligibility(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toBe(600);
      expect(result.usdCents).toBe(600);
      expect(result.amountKobo).toBe(600 * 1500); // 900,000 kobo (₦9,000)
    }
  });

  it("excludes funds already reserved in an active payout batch (prevents double deductions)", () => {
    // 600 OPN earned, but 600 OPN is already reserved in an in-flight batch
    const input: EligibilityInput = {
      ...baseInput,
      availableUnits: 600,
      reservedUnits: 600,
    };

    const result = evaluateEligibility(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("below_threshold");
    }
  });

  it("blocks payout inclusion if account is under fraud/risk review hold", () => {
    const input: EligibilityInput = {
      ...baseInput,
      availableUnits: 600,
      payoutHeld: true,
    };

    const result = evaluateEligibility(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("payout_review");
    }
  });
});
