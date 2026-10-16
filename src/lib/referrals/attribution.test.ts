import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { attributeReferral } from "@/lib/referrals/attribution";

describe("referral attribution", () => {
  it("rejects invalid or blank referral codes", async () => {
    const mockTx = {} as unknown as Prisma.TransactionClient;
    const result1 = await attributeReferral(mockTx, {
      referredUserId: "user-1",
      code: "",
    });
    expect(result1).toEqual({ ok: false, reason: "invalid_code" });

    const result2 = await attributeReferral(mockTx, {
      referredUserId: "user-1",
      code: "invalid!@#$",
    });
    expect(result2).toEqual({ ok: false, reason: "invalid_code" });
  });

  it("rejects non-existent or deleted referrers", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const mockTx = {
      user: { findUnique },
    } as unknown as Prisma.TransactionClient;

    const result = await attributeReferral(mockTx, {
      referredUserId: "user-1",
      code: "OPN8K2M9",
    });
    expect(result).toEqual({ ok: false, reason: "referrer_not_found" });

    findUnique.mockResolvedValue({ id: "referrer-1", deletedAt: new Date() });
    const resultDeleted = await attributeReferral(mockTx, {
      referredUserId: "user-1",
      code: "OPN8K2M9",
    });
    expect(resultDeleted).toEqual({ ok: false, reason: "referrer_not_found" });
  });

  it("strictly prevents self-referrals", async () => {
    const mockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-1", deletedAt: null }),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await attributeReferral(mockTx, {
      referredUserId: "user-1",
      code: "OPN8K2M9",
    });
    expect(result).toEqual({ ok: false, reason: "self_referral" });
  });

  it("strictly prevents re-attribution (immutable referral relationship)", async () => {
    const mockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "referrer-1", deletedAt: null }),
      },
      referral: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing-ref-id" }),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await attributeReferral(mockTx, {
      referredUserId: "user-1",
      code: "OPN8K2M9",
    });
    expect(result).toEqual({ ok: false, reason: "already_attributed" });
  });

  it("successfully attributes a new referred user", async () => {
    const create = vi.fn().mockResolvedValue({ id: "new-ref-id" });
    const mockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "referrer-1", deletedAt: null }),
      },
      referral: {
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as Prisma.TransactionClient;

    const result = await attributeReferral(mockTx, {
      referredUserId: "user-1",
      code: "opn8k2m9",
      source: "link",
    });

    expect(result).toEqual({
      ok: true,
      referralId: "new-ref-id",
      referrerId: "referrer-1",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        referrerId: "referrer-1",
        referredId: "user-1",
        codeUsed: "OPN8K2M9",
        source: "link",
      },
    });
  });
});
