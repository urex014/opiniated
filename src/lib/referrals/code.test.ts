import { describe, expect, it } from "vitest";
import { generateReferralCode, isValidReferralCode, normalizeReferralCode, referralLink } from "@/lib/referrals/code";

describe("referral code utilities", () => {
  it("generates unique, valid referral codes", () => {
    const code1 = generateReferralCode();
    const code2 = generateReferralCode();

    expect(code1).not.toBe(code2);
    expect(code1.startsWith("OPN")).toBe(true);
    expect(code1.length).toBe(8);
    expect(isValidReferralCode(code1)).toBe(true);
    expect(isValidReferralCode(code2)).toBe(true);
  });

  it("validates valid and invalid referral codes", () => {
    expect(isValidReferralCode("OPN8K2M9")).toBe(true);
    expect(isValidReferralCode("ABC_123-XYZ")).toBe(true);
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("ab")).toBe(false); // too short
    expect(isValidReferralCode("code with spaces")).toBe(false);
    expect(isValidReferralCode("invalid!@#$")).toBe(false);
  });

  it("normalizes referral codes cleanly", () => {
    expect(normalizeReferralCode("  opn8k2m9  ")).toBe("OPN8K2M9");
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode("invalid!@#")).toBeNull();
  });

  it("constructs standard referral link according to business rules", () => {
    const link = referralLink("OPN8K2M9", "https://opiniated.vercel.app");
    expect(link).toBe("https://opiniated.vercel.app/?ref=OPN8K2M9");
  });
});
