import { describe, expect, it } from "vitest";
import { isAdminEmail } from "@/lib/payouts/access";
import { maskEmail } from "@/lib/referrals/service";
import { updateReferralCommissionRate } from "@/lib/referrals/config";

describe("referral admin authorization and privacy", () => {
  const adminEmails = ["superadmin@opiniated.com", "finance@opiniated.com"];

  it("permits verified admin emails and rejects standard user emails", () => {
    expect(isAdminEmail("superadmin@opiniated.com", adminEmails)).toBe(true);
    expect(isAdminEmail("SUPERADMIN@OPINIATED.COM", adminEmails)).toBe(true);
    expect(isAdminEmail("attacker@badactor.com", adminEmails)).toBe(false);
    expect(isAdminEmail("regularuser@gmail.com", adminEmails)).toBe(false);
    expect(isAdminEmail("", adminEmails)).toBe(false);
  });

  it("protects user privacy with email masking", () => {
    expect(maskEmail("john.doe@gmail.com")).toBe("jo***e@gmail.com");
    expect(maskEmail("alex@outlook.com")).toBe("al***x@outlook.com");
    expect(maskEmail("ab@domain.com")).toBe("a*@domain.com");
    expect(maskEmail("invalid-email")).toBe("User");
  });

  it("rejects commission rates outside allowable bounds (1% to 50%)", async () => {
    const tooLow = await updateReferralCommissionRate({
      rateBps: 50, // 0.5% (below 100 bps)
      actorEmail: "admin@opiniated.com",
    });
    expect(tooLow.ok).toBe(false);

    const tooHigh = await updateReferralCommissionRate({
      rateBps: 5500, // 55% (above 5000 bps)
      actorEmail: "admin@opiniated.com",
    });
    expect(tooHigh.ok).toBe(false);

    const nonInteger = await updateReferralCommissionRate({
      rateBps: 12.5 as unknown as number,
      actorEmail: "admin@opiniated.com",
    });
    expect(nonInteger.ok).toBe(false);
  });
});
