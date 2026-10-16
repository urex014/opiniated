import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaystackClient } from "@/lib/paystack/client";
import { isAdminEmail } from "@/lib/payouts/access";
import { reconcileWithdrawal, retryWithdrawal } from "@/lib/payouts/admin-service";
import { saveBankAccount } from "@/lib/payouts/bank";
import { fundingCovers, pointsToKobo } from "@/lib/payouts/money";
import { MemoryPayoutRepository } from "@/lib/payouts/memory-repository";
import { submitApprovedBatch } from "@/lib/payouts/processor";
import { isTransferReference } from "@/lib/payouts/reference";
import { requestUserWithdrawal } from "@/lib/payouts/request";
import { handlePaystackWebhook } from "@/lib/payouts/webhook-handler";
import { resetRateLimits } from "@/lib/security/rate-limit";

const secret = "sk_test_example";
const payout = {
  bankCode: "058",
  bankName: "Guaranty Trust Bank",
  accountLast4: "6789",
  accountName: "ADA LOVELACE",
  recipientCode: "RCP_user",
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
};

function ref(n: number, attempt = 1): string {
  return `wd_${n.toString(16).padStart(24, "0")}_${attempt}`;
}

function repoWithUser(available = 500): MemoryPayoutRepository {
  const repo = new MemoryPayoutRepository();
  repo.seedUser({ id: "user-1", email: "ada@example.com", availableUnits: available, payout });
  return repo;
}

function client(overrides: Partial<PaystackClient> = {}): PaystackClient {
  const unexpected = async () => {
    throw new Error("unexpected Paystack call");
  };
  return {
    listBanks: unexpected,
    resolveAccount: unexpected,
    createRecipient: unexpected,
    bulkTransfer: unexpected,
    verifyTransfer: unexpected,
    getBalance: unexpected,
    ...overrides,
  };
}

async function approve(repo: MemoryPayoutRepository, id: string): Promise<void> {
  const result = await repo.review({ id, actorId: "admin-1", decision: "approve", reason: null, at: new Date() });
  expect(result.ok).toBe(true);
}

beforeEach(() => {
  resetRateLimits();
});

describe("withdrawal reservation", () => {
  it("reserves the ledger once and rejects a second request for the same points", async () => {
    const repo = repoWithUser(100);
    const now = new Date("2026-10-11T00:00:00.000Z");
    const [first, second] = await Promise.all([
      repo.requestWithdrawal({ userId: "user-1", points: 80, amountKobo: 8000, minimumKobo: 1000, reference: ref(1), status: "PENDING", currencyCode: "PTS", at: now }),
      repo.requestWithdrawal({ userId: "user-1", points: 80, amountKobo: 8000, minimumKobo: 1000, reference: ref(2), status: "PENDING", currencyCode: "PTS", at: now }),
    ]);
    const results = [first, second];
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.some((result) => !result.ok && (result.code === "insufficient" || result.code === "open_withdrawal"))).toBe(true);
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 100, reservedUnits: 80 });
  });

  it("rejects a duplicate reference without reserving twice", async () => {
    const repo = repoWithUser(200);
    const input = { userId: "user-1", points: 50, amountKobo: 5000, minimumKobo: 1000, reference: ref(3), status: "PENDING" as const, currencyCode: "PTS", at: new Date() };
    expect((await repo.requestWithdrawal(input)).ok).toBe(true);
    expect((await repo.requestWithdrawal({ ...input, points: 40, amountKobo: 4000 })).ok).toBe(false);
    expect(repo.balanceOf("user-1").reservedUnits).toBe(50);
  });

  it("enforces the minimum and ignores a client-side kobo amount", async () => {
    const repo = repoWithUser(1000);
    const below = await requestUserWithdrawal(repo, { userId: "user-1", points: 10, koboPerPoint: 100, minimumKobo: 10_000, currencyCode: "PTS", now: new Date() });
    expect(below.error).toContain("minimum");
    const accepted = await requestUserWithdrawal(repo, { userId: "user-1", points: 100, koboPerPoint: 100, minimumKobo: 10_000, currencyCode: "PTS", now: new Date() });
    expect(accepted.message).toContain("not a payment");
    const rows = await repo.listForUser("user-1");
    expect(rows[0]?.amountKobo).toBe(10_000);
    expect(pointsToKobo(100, 100)).toBe(10_000);
    expect(pointsToKobo(1.5, 100)).toBeNull();
  });

  it("does not let one user save another user's recipient", async () => {
    const repo = new MemoryPayoutRepository();
    repo.seedUser({ id: "user-1", email: "ada@example.com", availableUnits: 0 });
    repo.seedUser({ id: "user-2", email: "grace@example.com", availableUnits: 0 });
    const paystack = client({
      listBanks: async () => ({ ok: true, banks: [{ name: "Guaranty Trust Bank", code: "058" }] }),
      resolveAccount: async () => ({ ok: true, accountNumber: "0123456789", accountName: "ADA LOVELACE" }),
      createRecipient: async () => ({ ok: true, recipientCode: "RCP_shared" }),
    });
    const now = new Date();
    const saved = await saveBankAccount(paystack, repo, { userId: "user-1", bankCode: "058", accountNumber: "0123456789", confirmedName: "ada lovelace", now });
    expect(saved.message).toContain("6789");
    const taken = await saveBankAccount(paystack, repo, { userId: "user-2", bankCode: "058", accountNumber: "0123456789", confirmedName: "ADA LOVELACE", now });
    expect(taken.error).toContain("another profile");
    expect((await repo.getPayoutAccount("user-1"))?.accountLast4).toBe("6789");
    expect(await repo.getPayoutAccount("user-2")).toBeNull();
  }, 15_000);

  it("reuses the saved recipient when the verified account is unchanged", async () => {
    const repo = new MemoryPayoutRepository();
    repo.seedUser({ id: "user-1", email: "ada@example.com", availableUnits: 0 });
    const createRecipient = vi.fn(async () => ({ ok: true as const, recipientCode: "RCP_user" }));
    const paystack = client({
      listBanks: async () => ({ ok: true, banks: [{ name: "Guaranty Trust Bank", code: "058" }] }),
      resolveAccount: async () => ({ ok: true, accountNumber: "0123456789", accountName: "ADA LOVELACE" }),
      createRecipient,
    });
    const input = { userId: "user-1", bankCode: "058", accountNumber: "0123456789", confirmedName: "ADA LOVELACE", now: new Date() };
    expect((await saveBankAccount(paystack, repo, input)).message).toContain("6789");
    expect((await saveBankAccount(paystack, repo, input)).message).toContain("6789");
    expect(createRecipient).toHaveBeenCalledTimes(1);
  }, 15_000);
});

describe("transfer settlement", () => {
  it("finalizes a verified success once and releases a verified failure once", async () => {
    const repo = repoWithUser(100);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 1000, reference: ref(4), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    await repo.claimApproved([created.withdrawal.id], new Date());
    expect(await repo.settle({ reference: ref(4), verified: "success", amountKobo: 4000, currency: "NGN", transferCode: "TRF_1", at: new Date() })).toBe("paid");
    expect(await repo.settle({ reference: ref(4), verified: "success", amountKobo: 4000, currency: "NGN", transferCode: "TRF_1", at: new Date() })).toBe("ignored");
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 60, reservedUnits: 0 });

    const failedRepo = repoWithUser(100);
    const failed = await failedRepo.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 1000, reference: ref(5), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!failed.ok) throw new Error("expected reservation");
    await approve(failedRepo, failed.withdrawal.id);
    await failedRepo.claimApproved([failed.withdrawal.id], new Date());
    expect(await failedRepo.settle({ reference: ref(5), verified: "failed", amountKobo: 4000, currency: "NGN", transferCode: null, at: new Date() })).toBe("failed");
    expect(await failedRepo.settle({ reference: ref(5), verified: "failed", amountKobo: 4000, currency: "NGN", transferCode: null, at: new Date() })).toBe("ignored");
    expect(failedRepo.balanceOf("user-1")).toEqual({ availableUnits: 100, reservedUnits: 0 });
  });

  it("credits a reversal after payment once and releases a reversal that arrives first", async () => {
    const repo = repoWithUser(100);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 1000, reference: ref(6), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    await repo.claimApproved([created.withdrawal.id], new Date());
    await repo.settle({ reference: ref(6), verified: "success", amountKobo: 4000, currency: "NGN", transferCode: "TRF_2", at: new Date() });
    expect(await repo.settle({ reference: ref(6), verified: "reversed", amountKobo: 4000, currency: "NGN", transferCode: "TRF_2", at: new Date() })).toBe("reversed");
    expect(await repo.settle({ reference: ref(6), verified: "reversed", amountKobo: 4000, currency: "NGN", transferCode: "TRF_2", at: new Date() })).toBe("ignored");
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 100, reservedUnits: 0 });
    expect(repo.ledgerRows("user-1").filter((row) => row.providerTxId.endsWith(":reversal"))).toHaveLength(1);

    const early = repoWithUser(100);
    const pending = await early.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 1000, reference: ref(7), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!pending.ok) throw new Error("expected reservation");
    await approve(early, pending.withdrawal.id);
    await early.claimApproved([pending.withdrawal.id], new Date());
    expect(await early.settle({ reference: ref(7), verified: "reversed", amountKobo: 4000, currency: "NGN", transferCode: null, at: new Date() })).toBe("reversed");
    expect(early.balanceOf("user-1")).toEqual({ availableUnits: 100, reservedUnits: 0 });
  });

  it("flags a success after failure and a stale reference without moving money again", async () => {
    const repo = repoWithUser(100);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 1000, reference: ref(8), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    await repo.claimApproved([created.withdrawal.id], new Date());
    await repo.settle({ reference: ref(8), verified: "failed", amountKobo: 4000, currency: "NGN", transferCode: null, at: new Date() });
    expect(await repo.settle({ reference: ref(8), verified: "success", amountKobo: 4000, currency: "NGN", transferCode: "TRF_3", at: new Date() })).toBe("anomaly");
    expect(repo.balanceOf("user-1").availableUnits).toBe(100);

    const retry = await repo.beginRetry({ withdrawalId: created.withdrawal.id, actorId: "admin-1", reference: ref(9, 2), minimumKobo: 1000, currencyCode: "PTS", at: new Date() });
    expect(retry.ok).toBe(true);
    expect(await repo.settle({ reference: ref(8), verified: "success", amountKobo: 4000, currency: "NGN", transferCode: "TRF_3", at: new Date() })).toBe("anomaly");
    const current = await repo.getById(created.withdrawal.id);
    expect(current?.status).toBe("APPROVED");
    expect(current?.reference).toBe(ref(9, 2));
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 100, reservedUnits: 40 });
  });
});

describe("bulk processor", () => {
  it("stops when transfers are disabled, unconfirmed, underfunded, or inside the five-second gap", async () => {
    const repo = repoWithUser(1000);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 100, amountKobo: 10_000, minimumKobo: 1000, reference: ref(10), status: "PENDING", currencyCode: "PTS", at: new Date("2026-10-11T00:00:00.000Z") });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    const now = new Date("2026-10-11T01:00:00.000Z");
    const base = { repo, now, feeBufferKobo: 0, actorId: "admin-1", client: client() };
    expect((await submitApprovedBatch({ ...base, transfersEnabled: false, liveConfirmed: false, keyMode: "test" })).code).toBe("disabled");
    expect((await submitApprovedBatch({ ...base, transfersEnabled: true, liveConfirmed: false, keyMode: "live" })).code).toBe("live_not_confirmed");
    expect((await repo.getById(created.withdrawal.id))?.status).toBe("APPROVED");

    const poor = client({ getBalance: async () => ({ ok: true, balances: [{ currency: "NGN", amount: 10_000 }] }) });
    const funding = await submitApprovedBatch({ ...base, client: poor, transfersEnabled: true, liveConfirmed: true, keyMode: "test", feeBufferKobo: 50 });
    expect(funding.code).toBe("insufficient_funds");
    expect((await repo.getById(created.withdrawal.id))?.status).toBe("APPROVED");
    expect(fundingCovers(10_000, [10_000], 50)).toBe(false);
  });

  it("queues at most 100 transfers, keeps the queue response unpaid, and waits five seconds", async () => {
    const repo = new MemoryPayoutRepository();
    const ids: string[] = [];
    for (let index = 0; index < 101; index += 1) {
      const userId = `user-${index}`;
      repo.seedUser({ id: userId, email: `${userId}@example.com`, availableUnits: 100, payout: { ...payout, recipientCode: `RCP_${index}` } });
      const created = await repo.requestWithdrawal({
        userId,
        points: 100,
        amountKobo: 1000,
        minimumKobo: 100,
        reference: ref(index + 20),
        status: "PENDING",
        currencyCode: "PTS",
        at: new Date(index),
      });
      if (!created.ok) throw new Error("expected reservation");
      await approve(repo, created.withdrawal.id);
      ids.push(created.withdrawal.id);
    }
    const bulk = vi.fn(async () => ({
      outcome: "accepted" as const,
      message: "100 transfers queued.",
      items: ids.slice(0, 100).map((_id, index) => ({
        reference: ref(index + 20),
        recipient: `RCP_${index}`,
        amount: 1000,
        transferCode: `TRF_${index}`,
        status: "success",
      })),
    }));
    const paystack = client({
      getBalance: async () => ({ ok: true, balances: [{ currency: "NGN", amount: 200_000 }] }),
      bulkTransfer: bulk,
    });
    const now = new Date("2026-10-11T02:00:00.000Z");
    const queued = await submitApprovedBatch({ repo, client: paystack, now, transfersEnabled: true, liveConfirmed: false, keyMode: "test", feeBufferKobo: 0, actorId: "admin-1" });
    expect(queued).toMatchObject({ ok: true, code: "queued", count: 100 });
    expect(bulk).toHaveBeenCalledTimes(1);
    expect((await repo.getById(ids[0] ?? ""))?.status).toBe("PROCESSING");
    expect((await repo.getById(ids[0] ?? ""))?.transferCode).toBe("TRF_0");
    expect(repo.balanceOf("user-0")).toEqual({ availableUnits: 100, reservedUnits: 100 });
    expect((await repo.getById(ids[100] ?? ""))?.status).toBe("APPROVED");
    const again = await submitApprovedBatch({
      repo,
      client: paystack,
      now: new Date(now.getTime() + 1000),
      transfersEnabled: true,
      liveConfirmed: false,
      keyMode: "test",
      feeBufferKobo: 0,
      actorId: "admin-1",
    });
    expect(again.code).toBe("interval");
    expect(bulk).toHaveBeenCalledTimes(1);
    expect(isTransferReference(ref(20))).toBe(true);
  });

  it("leaves a timed-out batch processing and releases a rejected transfer only when Paystack has no record", async () => {
    const repo = repoWithUser(100);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 100, reference: ref(200), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    const uncertain = await submitApprovedBatch({
      repo,
      client: client({
        getBalance: async () => ({ ok: true, balances: [{ currency: "NGN", amount: 50_000 }] }),
        bulkTransfer: async () => ({ outcome: "uncertain", message: "Paystack did not respond." }),
      }),
      now: new Date("2026-10-11T03:00:00.000Z"),
      transfersEnabled: true,
      liveConfirmed: false,
      keyMode: "test",
      feeBufferKobo: 0,
      actorId: "admin-1",
    });
    expect(uncertain.code).toBe("uncertain");
    expect((await repo.getById(created.withdrawal.id))?.status).toBe("PROCESSING");
    expect(repo.balanceOf("user-1").reservedUnits).toBe(40);

    const rejectedRepo = repoWithUser(100);
    const rejected = await rejectedRepo.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 100, reference: ref(201), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!rejected.ok) throw new Error("expected reservation");
    await approve(rejectedRepo, rejected.withdrawal.id);
    const result = await submitApprovedBatch({
      repo: rejectedRepo,
      client: client({
        getBalance: async () => ({ ok: true, balances: [{ currency: "NGN", amount: 50_000 }] }),
        bulkTransfer: async () => ({ outcome: "rejected", message: "Insufficient balance" }),
        verifyTransfer: async () => ({ outcome: "not_found" }),
      }),
      now: new Date("2026-10-11T04:00:00.000Z"),
      transfersEnabled: true,
      liveConfirmed: false,
      keyMode: "test",
      feeBufferKobo: 0,
      actorId: "admin-1",
    });
    expect(result.code).toBe("rejected");
    expect((await rejectedRepo.getById(rejected.withdrawal.id))?.status).toBe("FAILED");
    expect(rejectedRepo.balanceOf("user-1")).toEqual({ availableUnits: 100, reservedUnits: 0 });
  });
});

describe("Paystack webhooks", () => {
  function signed(raw: string): string {
    return createHmac("sha512", secret).update(raw, "utf8").digest("hex");
  }

  it("rejects a bad signature before verification and settles a verified event once", async () => {
    const repo = repoWithUser(100);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 40, amountKobo: 4000, minimumKobo: 100, reference: ref(300), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    await repo.claimApproved([created.withdrawal.id], new Date());
    const verify = vi.fn(async () => ({ outcome: "found" as const, status: "success" as const, amount: 4000, currency: "NGN", transferCode: "TRF_webhook" }));
    const paystack = client({ verifyTransfer: verify });
    const raw = JSON.stringify({ event: "transfer.success", data: { reference: ref(300), amount: 4000, currency: "NGN" } });
    expect((await handlePaystackWebhook({ rawBody: raw, signature: "nope", secret, repo, client: paystack, now: new Date() })).status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
    expect((await handlePaystackWebhook({ rawBody: raw, signature: signed(raw), secret, repo, client: paystack, now: new Date() })).status).toBe(200);
    expect((await handlePaystackWebhook({ rawBody: raw, signature: signed(raw), secret, repo, client: paystack, now: new Date() })).status).toBe(200);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 60, reservedUnits: 0 });
  });

  it("keeps an unfinished verification retryable and applies failure and reversal in order", async () => {
    const repo = repoWithUser(100);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 25, amountKobo: 2500, minimumKobo: 100, reference: ref(301), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    await repo.claimApproved([created.withdrawal.id], new Date());
    const raw = JSON.stringify({ event: "transfer.reversed", data: { reference: ref(301) } });
    const pending = client({ verifyTransfer: async () => ({ outcome: "found", status: "pending", amount: 2500, currency: "NGN", transferCode: null }) });
    expect((await handlePaystackWebhook({ rawBody: raw, signature: signed(raw), secret, repo, client: pending, now: new Date() })).status).toBe(500);
    expect((await repo.getById(created.withdrawal.id))?.status).toBe("PROCESSING");

    const reversed = client({ verifyTransfer: async () => ({ outcome: "found" as const, status: "reversed" as const, amount: 2500, currency: "NGN", transferCode: "TRF_r" }) });
    expect((await handlePaystackWebhook({ rawBody: raw, signature: signed(raw), secret, repo, client: reversed, now: new Date() })).status).toBe(200);
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 100, reservedUnits: 0 });

    const failedRaw = JSON.stringify({ event: "transfer.failed", data: { reference: ref(302) } });
    const failedRepo = repoWithUser(80);
    const failed = await failedRepo.requestWithdrawal({ userId: "user-1", points: 20, amountKobo: 2000, minimumKobo: 100, reference: ref(302), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!failed.ok) throw new Error("expected reservation");
    await approve(failedRepo, failed.withdrawal.id);
    await failedRepo.claimApproved([failed.withdrawal.id], new Date());
    const failedClient = client({ verifyTransfer: async () => ({ outcome: "found" as const, status: "failed" as const, amount: 2000, currency: "NGN", transferCode: null }) });
    expect((await handlePaystackWebhook({ rawBody: failedRaw, signature: signed(failedRaw), secret, repo: failedRepo, client: failedClient, now: new Date() })).status).toBe(200);
    expect(failedRepo.balanceOf("user-1").reservedUnits).toBe(0);
  });

  it("reconciles against Paystack and retries only a confirmed failure", async () => {
    const repo = repoWithUser(100);
    const created = await repo.requestWithdrawal({ userId: "user-1", points: 30, amountKobo: 3000, minimumKobo: 100, reference: ref(303), status: "PENDING", currencyCode: "PTS", at: new Date() });
    if (!created.ok) throw new Error("expected reservation");
    await approve(repo, created.withdrawal.id);
    await repo.claimApproved([created.withdrawal.id], new Date());
    await repo.settle({ reference: ref(303), verified: "failed", amountKobo: 3000, currency: "NGN", transferCode: null, at: new Date() });
    const blocked = await retryWithdrawal(repo, client({ verifyTransfer: async () => ({ outcome: "not_found" }) }), {
      id: created.withdrawal.id,
      actorId: "admin-1",
      reference: ref(304, 2),
      minimumKobo: 100,
      currencyCode: "PTS",
      at: new Date(),
    });
    expect(blocked.error).toContain("not been confirmed");
    const retried = await retryWithdrawal(
      repo,
      client({ verifyTransfer: async () => ({ outcome: "found", status: "failed", amount: 3000, currency: "NGN", transferCode: null }) }),
      { id: created.withdrawal.id, actorId: "admin-1", reference: ref(304, 2), minimumKobo: 100, currencyCode: "PTS", at: new Date() },
    );
    expect(retried.message).toContain("has not been sent");
    expect((await repo.getById(created.withdrawal.id))?.status).toBe("APPROVED");
    const reconciled = await reconcileWithdrawal(
      repo,
      client({ verifyTransfer: async () => ({ outcome: "found", status: "success", amount: 3000, currency: "NGN", transferCode: "TRF_late" }) }),
      created.withdrawal.id,
      "admin-1",
      new Date(),
    );
    expect(reconciled.message).toContain("flagged");
  });
});

describe("admin access", () => {
  it("matches only configured admin emails", () => {
    expect(isAdminEmail("Admin@Example.com", ["admin@example.com"])).toBe(true);
    expect(isAdminEmail("person@example.com", ["admin@example.com"])).toBe(false);
    expect(isAdminEmail("admin@example.com", [])).toBe(false);
  });
});
