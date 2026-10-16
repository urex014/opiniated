import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { processReferralForEvent } from "@/lib/referrals/processor";
import type { ValidatedCallback } from "@/lib/rewards/types";

vi.mock("@/lib/risk/persist", () => ({
  heldUserIds: vi.fn().mockResolvedValue(new Set<string>()),
}));

describe("processReferralForEvent", () => {
  let mockTx: Prisma.TransactionClient;
  let referralFindUnique: ReturnType<typeof vi.fn>;
  let commissionFindUnique: ReturnType<typeof vi.fn>;
  let commissionFindFirst: ReturnType<typeof vi.fn>;
  let commissionCreate: ReturnType<typeof vi.fn>;
  let commissionUpdate: ReturnType<typeof vi.fn>;
  let accountFindUnique: ReturnType<typeof vi.fn>;
  let accountUpsert: ReturnType<typeof vi.fn>;
  let accountUpdate: ReturnType<typeof vi.fn>;
  let transactionCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    referralFindUnique = vi.fn();
    commissionFindUnique = vi.fn();
    commissionFindFirst = vi.fn();
    commissionCreate = vi.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "comm-1", ...args.data }),
    );
    commissionUpdate = vi.fn();
    accountFindUnique = vi.fn();
    accountUpsert = vi.fn();
    accountUpdate = vi.fn();
    transactionCreate = vi.fn();

    mockTx = {
      referral: {
        findUnique: referralFindUnique,
      },
      referralCommission: {
        findUnique: commissionFindUnique,
        findFirst: commissionFindFirst,
        create: commissionCreate,
        update: commissionUpdate,
      },
      rewardAccount: {
        findUnique: accountFindUnique,
        upsert: accountUpsert,
        update: accountUpdate,
      },
      rewardTransaction: {
        create: transactionCreate,
      },
    } as unknown as Prisma.TransactionClient;
  });

  const baseEvent: ValidatedCallback = {
    provider: "cpx",
    userId: "referred-user-1",
    providerTxId: "cpx-tx-100",
    type: "COMPLETE",
    amountUnits: 40,
    currencyCode: "OPN",
    surveyId: "survey-555",
    refTxId: null,
    reason: null,
    providerUsd: "0.60",
    disposition: "reward",
  };

  it("returns NOT_REFERRED when the user was not referred", async () => {
    referralFindUnique.mockResolvedValue(null);

    const result = await processReferralForEvent(mockTx, baseEvent, 1000);
    expect(result).toEqual({ outcome: "NOT_REFERRED" });
    expect(commissionCreate).not.toHaveBeenCalled();
  });

  it("credits 10% commission on confirmed survey completion for a referred user", async () => {
    referralFindUnique.mockResolvedValue({
      id: "ref-rel-1",
      referrerId: "referrer-user-99",
      referredId: "referred-user-1",
    });
    commissionFindUnique.mockResolvedValue(null);

    // Survey worth $1: user gets 40 OPN, Opiniated share is 60 OPN, referrer gets 10% = 6 OPN
    const result = await processReferralForEvent(mockTx, baseEvent, 1000);

    expect(result).toEqual({
      outcome: "COMMISSION_CREDITED",
      amountUnits: 6,
      referrerId: "referrer-user-99",
    });

    expect(commissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        referralId: "ref-rel-1",
        referrerId: "referrer-user-99",
        referredId: "referred-user-1",
        provider: "cpx",
        providerTxId: "cpx-tx-100",
        eventType: "CREDIT",
        status: "APPROVED",
        userRewardUnits: 40,
        opiniatedShareUnits: 60,
        commissionRateBps: 1000,
        amountUnits: 6,
      }),
    });

    expect(accountUpsert).toHaveBeenCalledWith({
      where: { userId: "referrer-user-99" },
      create: { userId: "referrer-user-99", availableUnits: 6, lifetimeCreditedUnits: 6 },
      update: { availableUnits: { increment: 6 }, lifetimeCreditedUnits: { increment: 6 } },
    });

    expect(transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "referrer-user-99",
        provider: "referral",
        providerTxId: "ref:cpx:cpx-tx-100",
        type: "COMPLETE",
        amountUnits: 6,
        status: "APPROVED",
      }),
    });
  });

  it("enforces idempotency and returns DUPLICATE on repeated callbacks", async () => {
    referralFindUnique.mockResolvedValue({
      id: "ref-rel-1",
      referrerId: "referrer-user-99",
      referredId: "referred-user-1",
    });
    commissionFindUnique.mockResolvedValue({ id: "existing-comm" });

    const result = await processReferralForEvent(mockTx, baseEvent, 1000);
    expect(result).toEqual({ outcome: "DUPLICATE" });
    expect(commissionCreate).not.toHaveBeenCalled();
    expect(accountUpsert).not.toHaveBeenCalled();
  });

  it("places commission on HOLD without crediting balance if user or referrer is flagged in risk review", async () => {
    const { heldUserIds } = await import("@/lib/risk/persist");
    (heldUserIds as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Set(["referred-user-1"]));

    referralFindUnique.mockResolvedValue({
      id: "ref-rel-1",
      referrerId: "referrer-user-99",
      referredId: "referred-user-1",
    });
    commissionFindUnique.mockResolvedValue(null);

    const result = await processReferralForEvent(mockTx, baseEvent, 1000);

    expect(result).toEqual({
      outcome: "COMMISSION_HELD",
      amountUnits: 6,
      referrerId: "referrer-user-99",
    });

    expect(commissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "HELD",
        holdReason: "Referrer or referred account under risk hold",
      }),
    });

    expect(accountUpsert).not.toHaveBeenCalled();
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it("safely reverses referral commission when underlying survey is reversed", async () => {
    referralFindUnique.mockResolvedValue({
      id: "ref-rel-1",
      referrerId: "referrer-user-99",
      referredId: "referred-user-1",
    });

    commissionFindFirst.mockResolvedValue({
      id: "original-comm-id",
      referralId: "ref-rel-1",
      referrerId: "referrer-user-99",
      referredId: "referred-user-1",
      provider: "cpx",
      providerTxId: "cpx-tx-100",
      status: "APPROVED",
      amountUnits: 6,
      opiniatedShareUnits: 60,
      commissionRateBps: 1000,
    });

    commissionFindUnique.mockResolvedValue(null);
    accountFindUnique.mockResolvedValue({
      availableUnits: 50,
      reservedUnits: 0,
      lifetimeCreditedUnits: 50,
    });

    const reversalEvent: ValidatedCallback = {
      ...baseEvent,
      type: "RECONCILIATION",
      providerTxId: "cpx-tx-100:reversal",
      refTxId: "cpx-tx-100",
      amountUnits: -40,
    };

    const result = await processReferralForEvent(mockTx, reversalEvent, 1000);

    expect(result).toEqual({
      outcome: "COMMISSION_REVERSED",
      amountUnits: 6,
      referrerId: "referrer-user-99",
    });

    expect(commissionUpdate).toHaveBeenCalledWith({
      where: { id: "original-comm-id" },
      data: { status: "REVERSED" },
    });

    expect(commissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "REVERSAL",
        status: "REVERSED",
        amountUnits: -6,
      }),
    });

    expect(accountUpdate).toHaveBeenCalledWith({
      where: { userId: "referrer-user-99" },
      data: {
        availableUnits: 44,
        reservedUnits: 0,
        lifetimeCreditedUnits: 50,
      },
    });
  });
});
