import { describe, expect, it, vi } from "vitest";
import type { PaystackClient } from "@/lib/paystack/client";
import { deriveBatchStatus } from "@/lib/payouts/batch-status";
import { cronAuthorized } from "@/lib/payouts/cron-auth";
import { runAutoPayout } from "@/lib/payouts/cycle";
import { evaluateEligibility, formatUsdFromCents, payoutNotice } from "@/lib/payouts/eligibility";
import { enrollEligible, type PayoutCandidate } from "@/lib/payouts/enroll";
import { manualWithdrawalRefusal } from "@/lib/payouts/manual";
import { MemoryAutoPayoutStore } from "@/lib/payouts/memory-schedule";
import { MemoryPayoutRepository } from "@/lib/payouts/memory-repository";
import { estimatedPaystackFeeKobo, fundingCoversWithFees } from "@/lib/payouts/money";
import { parseFxPolicy, parseScheduleSettings } from "@/lib/payouts/schedule-policy";

const now = new Date("2026-10-11T12:00:00.000Z");
const bankOld = new Date("2026-10-01T00:00:00.000Z");
const fx = { nairaPerUsd: 1500, effectiveAt: new Date("2026-10-10T00:00:00.000Z"), expiresAt: new Date("2026-10-20T00:00:00.000Z") };

function candidate(overrides: Partial<PayoutCandidate> = {}): PayoutCandidate {
  return {
    userId: "user-1",
    email: "ada@example.com",
    deletedAt: null,
    availableUnits: 500,
    reservedUnits: 0,
    accountUpdatedAt: bankOld,
    recipientCode: "RCP_user",
    openWithdrawal: false,
    ...overrides,
  };
}

function eligibility(overrides: Partial<Parameters<typeof evaluateEligibility>[0]> = {}) {
  return evaluateEligibility({
    deletedAt: null,
    availableUnits: 500,
    reservedUnits: 0,
    accountUpdatedAt: bankOld,
    recipientCode: "RCP_user",
    openWithdrawal: false,
    currencyCode: "OPN",
    nairaPerUsd: 1500,
    rateExpiresAt: fx.expiresAt,
    now,
    minUsdCents: 500,
    minimumKobo: 10_000,
    ...overrides,
  });
}

function refFor(userId: string): string {
  const n = Number(userId.split("-")[1] ?? 0);
  return `wd_${n.toString(16).padStart(24, "0")}_1`;
}

function seed(repo: MemoryPayoutRepository, id: string, units: number, payoutAt: Date | null = bankOld): void {
  repo.seedUser({
    id,
    email: `${id}@example.com`,
    availableUnits: units,
    payout: payoutAt ? { bankCode: "058", bankName: "Guaranty Trust Bank", accountLast4: "6789", accountName: "ADA LOVELACE", recipientCode: `RCP_${id}`, updatedAt: payoutAt } : undefined,
  });
}

function storeFor(repo: MemoryPayoutRepository, people: PayoutCandidate[]): MemoryAutoPayoutStore {
  const store = new MemoryAutoPayoutStore(repo, now);
  store.paused = false;
  store.policies = [fx];
  store.candidates = people;
  return store;
}

function client(bulk: PaystackClient["bulkTransfer"]): PaystackClient {
  const unexpected = async () => {
    throw new Error("unexpected Paystack call");
  };
  return {
    listBanks: unexpected,
    resolveAccount: unexpected,
    createRecipient: unexpected,
    verifyTransfer: unexpected,
    getBalance: async () => ({ ok: true, balances: [{ currency: "NGN", amount: 2_000_000_000 }] }),
    bulkTransfer: bulk,
  };
}

async function cycle(repo: MemoryPayoutRepository, store: MemoryAutoPayoutStore, paystack: PaystackClient | null = null, transfersEnabled = false) {
  return runAutoPayout({
    store,
    repo,
    client: paystack,
    now,
    currencyCode: "OPN",
    minimumKobo: 10_000,
    transfersEnabled,
    liveConfirmed: false,
    keyMode: "test",
    feeBufferKobo: 0,
    referenceFor: refFor,
  });
}

describe("automatic payout eligibility", () => {
  it("pays $5 and above, and keeps $4.99 unreserved", () => {
    expect(eligibility({ availableUnits: 499 }).ok).toBe(false);
    const exact = eligibility({ availableUnits: 500 });
    const above = eligibility({ availableUnits: 501 });
    expect(exact.ok && exact.points).toBe(500);
    expect(exact.ok && exact.amountKobo).toBe(750_000);
    expect(above.ok && above.points).toBe(501);
    expect(eligibility({ recipientCode: null }).ok).toBe(false);
    expect(eligibility({ availableUnits: 400 }).ok).toBe(false);
    expect(eligibility({ openWithdrawal: true }).ok).toBe(false);
    expect(eligibility({ accountUpdatedAt: now }).ok).toBe(false);
    expect(eligibility({ deletedAt: now }).ok).toBe(false);
    expect(eligibility({ currencyCode: "PTS" }).ok).toBe(false);
    expect(eligibility({ nairaPerUsd: null })).toMatchObject({ ok: false, reason: "no_rate" });
    expect(eligibility({ rateExpiresAt: now })).toMatchObject({ ok: false, reason: "rate_expired" });
    expect(eligibility({ nairaPerUsd: 1, availableUnits: 500 })).toMatchObject({ ok: false, reason: "below_paystack_min" });
    expect(eligibility({ availableUnits: 700_000 })).toMatchObject({ ok: false, reason: "above_paystack_max" });
  });

  it("uses the required payout sentences", () => {
    expect(formatUsdFromCents(240)).toBe("$2.40");
    const base = { hasVerifiedBank: true, bankReady: true, phase: "none" as const, spendableUnits: 260, minUsdCents: 500, currencyCode: "OPN", aboveTransferMax: false, belowTransferMin: false };
    expect(payoutNotice(base)).toBe("You need $2.40 more to qualify for a payout.");
    expect(payoutNotice({ ...base, spendableUnits: 500 })).toBe("You're eligible for the next payout batch. No action is required.");
    expect(payoutNotice({ ...base, phase: "scheduled" })).toBe("Your payout has been included in an upcoming batch.");
    expect(payoutNotice({ ...base, phase: "processing" })).toBe("Your payout is being processed.");
    expect(payoutNotice({ ...base, phase: "paid", spendableUnits: 0 })).toBe("Your payout has been completed.");
    expect(payoutNotice({ ...base, hasVerifiedBank: false, bankReady: false })).toBe("Connect and verify your bank account to receive payouts automatically.");
  });

  it("rejects a manual withdrawal and a bad cron secret", () => {
    expect(manualWithdrawalRefusal().error).toBe("Withdrawals are paid automatically. There is no manual withdrawal request.");
    expect(cronAuthorized(null, "cron-secret-value")).toBe(false);
    expect(cronAuthorized("Bearer wrong-secret-value", "cron-secret-value")).toBe(false);
    expect(cronAuthorized("Bearer cron-secret-value", "cron-secret-value")).toBe(true);
    expect(parseScheduleSettings({ intervalDays: 0, minUsdCents: 500 }).ok).toBe(false);
    expect(parseFxPolicy({ nairaPerUsd: 1500, validForDays: 31, now }).ok).toBe(false);
    expect(estimatedPaystackFeeKobo(1_000)).toBe(1_000);
    expect(estimatedPaystackFeeKobo(1_000_000)).toBe(7_500);
    expect(fundingCoversWithFees(10_000, [10_000], 0)).toBe(false);
    expect(deriveBatchStatus(["PAID"], "QUEUED")).toBe("COMPLETED");
    expect(deriveBatchStatus(["FAILED"], "QUEUED")).toBe("FAILED");
    expect(deriveBatchStatus(["PAID", "FAILED"], "QUEUED")).toBe("PARTIALLY_COMPLETED");
    expect(deriveBatchStatus(["REJECTED"], "PENDING")).toBe("CANCELLED");
  });
});

describe("scheduled payout batches", () => {
  it("reserves $5 once, skips a repeated run, and keeps an expired rate from pricing anyone", async () => {
    const repo = new MemoryPayoutRepository();
    seed(repo, "user-1", 500);
    const store = storeFor(repo, [candidate()]);
    expect((await cycle(repo, store)).status).toBe("enrolled");
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 500, reservedUnits: 500 });
    expect(repo.batchRows()).toHaveLength(1);
    expect((await repo.listForUser("user-1"))[0]?.nairaPerUsd).toBe(1500);
    store.policies = [{ ...fx, nairaPerUsd: 1600 }];
    expect((await cycle(repo, store)).status).toBe("waiting");
    expect(repo.batchRows()).toHaveLength(1);
    expect((await repo.listForUser("user-1"))[0]?.nairaPerUsd).toBe(1500);

    const poor = new MemoryPayoutRepository();
    seed(poor, "user-1", 499);
    const poorStore = storeFor(poor, [candidate({ availableUnits: 499 })]);
    expect((await cycle(poor, poorStore)).enrolled).toBe(0);
    expect(poor.balanceOf("user-1").reservedUnits).toBe(0);

    const unpriced = new MemoryPayoutRepository();
    seed(unpriced, "user-1", 800);
    const unpricedStore = storeFor(unpriced, [candidate({ availableUnits: 800 })]);
    unpricedStore.policies = [{ ...fx, expiresAt: now }];
    expect((await cycle(unpriced, unpricedStore)).status).toBe("no_rate");
    expect(unpriced.balanceOf("user-1").reservedUnits).toBe(0);
  });

  it("does not reserve the same funds twice under concurrent runs or a second enrollment", async () => {
    const repo = new MemoryPayoutRepository();
    seed(repo, "user-1", 800);
    const store = storeFor(repo, [candidate({ availableUnits: 800 })]);
    const [first, second] = await Promise.all([cycle(repo, store), cycle(repo, store)]);
    expect([first.status, second.status].sort()).toEqual(["enrolled", "locked"]);
    expect(repo.balanceOf("user-1").reservedUnits).toBe(800);
    const again = await enrollEligible({
      repo,
      candidates: [candidate({ availableUnits: 800, openWithdrawal: false })],
      currencyCode: "OPN",
      nairaPerUsd: 1500,
      rateAt: fx.effectiveAt,
      rateExpiresAt: fx.expiresAt,
      now,
      minUsdCents: 500,
      minimumKobo: 10_000,
      referenceFor: () => refFor("user-2"),
    });
    expect(again).toHaveLength(0);
    expect(repo.balanceOf("user-1").reservedUnits).toBe(800);
  });

  it("splits a batch at 100 and does not send a second transfer after a timeout", async () => {
    const repo = new MemoryPayoutRepository();
    const people: PayoutCandidate[] = [];
    for (let index = 1; index <= 101; index += 1) {
      seed(repo, `user-${index}`, 500);
      people.push(candidate({ userId: `user-${index}`, email: `user-${index}@example.com`, recipientCode: `RCP_user-${index}` }));
    }
    const store = storeFor(repo, people);
    expect((await cycle(repo, store)).enrolled).toBe(100);
    expect(repo.balanceOf("user-101").reservedUnits).toBe(0);
    expect((await cycle(repo, store)).enrolled).toBe(1);
    expect(repo.batchRows()).toHaveLength(2);
    expect(repo.balanceOf("user-101").reservedUnits).toBe(500);

    const one = new MemoryPayoutRepository();
    seed(one, "user-1", 500);
    const oneStore = storeFor(one, [candidate()]);
    const bulk = vi.fn(async () => ({ outcome: "uncertain" as const, message: "Paystack did not respond." }));
    expect((await cycle(one, oneStore, client(bulk), true)).submitted).toBe(0);
    expect(bulk).toHaveBeenCalledTimes(1);
    const reference = (await one.listForUser("user-1"))[0]?.reference;
    expect((await one.listForUser("user-1"))[0]?.status).toBe("PROCESSING");
    expect((await cycle(one, oneStore, client(bulk), true)).status).toBe("waiting");
    expect(bulk).toHaveBeenCalledTimes(1);
    expect((await one.listForUser("user-1"))[0]?.reference).toBe(reference);
  });

  it("pauses submissions and completes or releases a batch without a second credit", async () => {
    const repo = new MemoryPayoutRepository();
    seed(repo, "user-1", 500);
    const store = storeFor(repo, [candidate()]);
    await cycle(repo, store);
    store.paused = true;
    const bulk = vi.fn(async () => ({ outcome: "accepted" as const, message: "queued", items: [] }));
    expect((await cycle(repo, store, client(bulk), true)).status).toBe("paused");
    expect(bulk).not.toHaveBeenCalled();

    const row = (await repo.listForUser("user-1"))[0];
    if (!row) throw new Error("expected payout");
    await repo.claimApproved([row.id], now);
    await repo.updateBatch(repo.batchRows()[0]?.id ?? "", { status: "QUEUED", message: null });
    expect(await repo.settle({ reference: row.reference, verified: "success", amountKobo: row.amountKobo, currency: "NGN", transferCode: "TRF_1", at: now })).toBe("paid");
    expect(repo.batchRows()[0]?.status).toBe("COMPLETED");
    expect(await repo.settle({ reference: row.reference, verified: "reversed", amountKobo: row.amountKobo, currency: "NGN", transferCode: "TRF_1", at: now })).toBe("reversed");
    expect(await repo.settle({ reference: row.reference, verified: "reversed", amountKobo: row.amountKobo, currency: "NGN", transferCode: "TRF_1", at: now })).toBe("ignored");
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 500, reservedUnits: 0 });
    expect(repo.ledgerRows("user-1").filter((entry) => entry.providerTxId.endsWith(":reversal"))).toHaveLength(1);
  });
});
