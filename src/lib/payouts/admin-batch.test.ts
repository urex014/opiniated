import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PaystackClient } from "@/lib/paystack/client";
import { isAdminEmail } from "@/lib/payouts/access";
import { prepareAdminBatch, releaseAdminBatch } from "@/lib/payouts/admin-batch";
import { reconcileWithdrawal } from "@/lib/payouts/admin-service";
import type { PayoutCandidate } from "@/lib/payouts/enroll";
import { MemoryAutoPayoutStore } from "@/lib/payouts/memory-schedule";
import { MemoryPayoutRepository } from "@/lib/payouts/memory-repository";
import { handlePaystackWebhook } from "@/lib/payouts/webhook-handler";

const now = new Date("2026-10-11T12:00:00.000Z");
const bankOld = new Date("2026-10-01T00:00:00.000Z");
const fx = { nairaPerUsd: 1500, effectiveAt: new Date("2026-10-10T00:00:00.000Z"), expiresAt: new Date("2026-10-20T00:00:00.000Z") };
const secret = "sk_test_example";

function refFor(userId: string): string {
  const n = Number(userId.split("-")[1] ?? 0);
  return `wd_${n.toString(16).padStart(24, "0")}_1`;
}

function candidate(id: string): PayoutCandidate {
  return {
    userId: id,
    email: `${id}@example.com`,
    deletedAt: null,
    availableUnits: 500,
    reservedUnits: 0,
    accountUpdatedAt: bankOld,
    recipientCode: `RCP_${id}`,
    openWithdrawal: false,
  };
}

function seed(repo: MemoryPayoutRepository, id: string): void {
  repo.seedUser({
    id,
    email: `${id}@example.com`,
    availableUnits: 500,
    payout: { bankCode: "058", bankName: "Guaranty Trust Bank", accountLast4: "6789", accountName: "ADA LOVELACE", recipientCode: `RCP_${id}`, updatedAt: bankOld },
  });
}

function storeFor(repo: MemoryPayoutRepository, ids: string[]): MemoryAutoPayoutStore {
  const store = new MemoryAutoPayoutStore(repo, now);
  store.paused = false;
  store.policies = [fx];
  store.candidates = ids.map(candidate);
  return store;
}

function client(overrides: Partial<PaystackClient> = {}): PaystackClient {
  const unexpected = async () => {
    throw new Error("unexpected Paystack call");
  };
  return {
    listBanks: unexpected,
    resolveAccount: unexpected,
    createRecipient: unexpected,
    verifyTransfer: unexpected,
    getBalance: async () => ({ ok: true, balances: [{ currency: "NGN", amount: 2_000_000_000 }] }),
    bulkTransfer: unexpected,
    ...overrides,
  };
}

async function prepared(ids: string[]) {
  const repo = new MemoryPayoutRepository();
  for (const id of ids) seed(repo, id);
  const store = storeFor(repo, ids);
  const created = await prepareAdminBatch({
    admin: true,
    store,
    repo,
    now,
    currencyCode: "OPN",
    minimumKobo: 10_000,
    minUsdCents: 500,
    actorId: "admin-1",
    referenceFor: refFor,
  });
  const batchId = created.batchIds[0];
  if (!batchId) throw new Error("expected batch");
  const batch = await repo.getBatch(batchId);
  if (!batch) throw new Error("expected batch row");
  return { repo, batch };
}

function release(
  repo: MemoryPayoutRepository,
  batch: { id: string; transferCount: number; totalKobo: number },
  paystack: PaystackClient,
  patch: Partial<Parameters<typeof releaseAdminBatch>[0]> = {},
) {
  return releaseAdminBatch({
    admin: true,
    paused: false,
    repo,
    client: paystack,
    batchId: batch.id,
    confirmCount: batch.transferCount,
    confirmKobo: batch.totalKobo,
    actorId: "admin-1",
    now,
    transfersEnabled: true,
    liveConfirmed: true,
    keyMode: "test",
    feeBufferKobo: 0,
    ...patch,
  });
}

describe("admin batch release", () => {
  it("refuses a non-admin, a mismatched confirmation, a pause, and a dry run before Paystack", async () => {
    expect(isAdminEmail("person@example.com", ["admin@example.com"])).toBe(false);
    const repo = new MemoryPayoutRepository();
    seed(repo, "user-1");
    const denied = await prepareAdminBatch({
      admin: false,
      store: storeFor(repo, ["user-1"]),
      repo,
      now,
      currencyCode: "OPN",
      minimumKobo: 10_000,
      minUsdCents: 500,
      actorId: "user-1",
      referenceFor: refFor,
    });
    expect(denied.status).toBe("forbidden");
    expect(repo.balanceOf("user-1").reservedUnits).toBe(0);

    const { repo: ready, batch } = await prepared(["user-1"]);
    const bulk = vi.fn(async () => ({ outcome: "accepted" as const, message: "queued", items: [] }));
    const paystack = client({ bulkTransfer: bulk });
    expect((await release(ready, batch, paystack, { admin: false, actorId: "user-9" })).code).toBe("forbidden");
    expect((await release(ready, batch, paystack, { confirmKobo: batch.totalKobo + 1 })).code).toBe("confirmation_mismatch");
    expect((await release(ready, batch, paystack, { paused: true })).code).toBe("disabled");
    expect((await release(ready, batch, paystack, { transfersEnabled: false })).code).toBe("disabled");
    expect(bulk).not.toHaveBeenCalled();
    expect((await ready.listForUser("user-1"))[0]?.status).toBe("APPROVED");
    expect(ready.balanceOf("user-1")).toEqual({ availableUnits: 500, reservedUnits: 500 });
  });

  it("queues one confirmed batch once for concurrent and repeated release, without marking it paid", async () => {
    const { repo, batch } = await prepared(["user-1"]);
    const bulk = vi.fn(async (transfers: { reference: string; recipient: string; amount: number }[]) => ({
      outcome: "accepted" as const,
      message: "1 transfers queued.",
      items: transfers.map((transfer) => ({ ...transfer, transferCode: "TRF_1", status: "success" })),
    }));
    const paystack = client({ bulkTransfer: bulk });
    const [first, second] = await Promise.all([release(repo, batch, paystack), release(repo, batch, paystack)]);
    expect(first.code === "queued" || second.code === "queued").toBe(true);
    expect(bulk).toHaveBeenCalledTimes(1);
    expect((await release(repo, batch, paystack)).code).toBe("not_releasable");
    expect(bulk).toHaveBeenCalledTimes(1);
    const row = (await repo.listForUser("user-1"))[0];
    expect(row?.status).toBe("PROCESSING");
    expect(row?.reference).toBe(refFor("user-1"));
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 500, reservedUnits: 500 });
    expect(repo.auditCount("batch.reviewed")).toBe(1);
    expect(repo.auditCount("batch.released")).toBe(1);
    expect(repo.auditCount("withdrawal.paid")).toBe(0);
  });

  it("keeps a partial queue pending, then settles each verified outcome once", async () => {
    const { repo, batch } = await prepared(["user-1", "user-2"]);
    const bulk = vi.fn(async (transfers: { reference: string; recipient: string; amount: number }[]) => ({
      outcome: "accepted" as const,
      message: "2 transfers queued.",
      items: transfers.slice(0, 1).map((transfer) => ({ ...transfer, transferCode: "TRF_one", status: "success" })),
    }));
    expect((await release(repo, batch, client({ bulkTransfer: bulk }))).code).toBe("queued");
    expect(bulk).toHaveBeenCalledTimes(1);
    expect((await repo.listForUser("user-1"))[0]?.status).toBe("PROCESSING");
    expect((await repo.listForUser("user-2"))[0]?.status).toBe("PROCESSING");
    const first = (await repo.listForUser("user-1"))[0];
    const second = (await repo.listForUser("user-2"))[0];
    if (!first || !second) throw new Error("expected both payouts");
    expect(await repo.settle({ reference: first.reference, verified: "success", amountKobo: first.amountKobo, currency: "NGN", transferCode: "TRF_one", at: now })).toBe("paid");
    expect(await repo.settle({ reference: second.reference, verified: "failed", amountKobo: second.amountKobo, currency: "NGN", transferCode: null, at: now })).toBe("failed");
    expect(await repo.settle({ reference: first.reference, verified: "success", amountKobo: first.amountKobo, currency: "NGN", transferCode: "TRF_one", at: now })).toBe("ignored");
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 0, reservedUnits: 0 });
    expect(repo.balanceOf("user-2")).toEqual({ availableUnits: 500, reservedUnits: 0 });
    expect(repo.auditCount("withdrawal.paid")).toBe(1);
    expect(repo.auditCount("withdrawal.failed")).toBe(1);
  });

  it("leaves pending transfers pending and applies one verified webhook", async () => {
    const { repo, batch } = await prepared(["user-1"]);
    const row = (await repo.listForUser("user-1"))[0];
    if (!row) throw new Error("expected payout");
    const bulk = vi.fn(async () => ({
      outcome: "accepted" as const,
      message: "1 transfers queued.",
      items: [{ reference: row.reference, recipient: "RCP_user-1", amount: row.amountKobo, transferCode: "TRF_w", status: "pending" }],
    }));
    expect((await release(repo, batch, client({ bulkTransfer: bulk }))).code).toBe("queued");
    const pendingClient = client({ verifyTransfer: async () => ({ outcome: "found", status: "pending", amount: row.amountKobo, currency: "NGN", transferCode: "TRF_w" }) });
    const reconciled = await reconcileWithdrawal(repo, pendingClient, row.id, "admin-1", now);
    expect(reconciled.message).toContain("not finished");
    expect((await repo.getById(row.id))?.status).toBe("PROCESSING");
    const raw = JSON.stringify({ event: "transfer.success", data: { reference: row.reference, amount: row.amountKobo, currency: "NGN" } });
    const signature = createHmac("sha512", secret).update(raw, "utf8").digest("hex");
    expect((await handlePaystackWebhook({ rawBody: raw, signature, secret, repo, client: pendingClient, now })).status).toBe(500);
    const paid = client({ verifyTransfer: async () => ({ outcome: "found", status: "success", amount: row.amountKobo, currency: "NGN", transferCode: "TRF_w" }) });
    expect((await handlePaystackWebhook({ rawBody: raw, signature, secret, repo, client: paid, now })).status).toBe(200);
    expect((await handlePaystackWebhook({ rawBody: raw, signature, secret, repo, client: paid, now })).status).toBe(200);
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 0, reservedUnits: 0 });
    expect(repo.auditCount("withdrawal.paid")).toBe(1);
  });

  it("releases a rejected transfer only after Paystack reports it was not created", async () => {
    const { repo, batch } = await prepared(["user-1"]);
    const paystack = client({
      bulkTransfer: async () => ({ outcome: "rejected", message: "Insufficient balance" }),
      verifyTransfer: async () => ({ outcome: "not_found" as const }),
    });
    expect((await release(repo, batch, paystack)).code).toBe("rejected");
    expect((await repo.listForUser("user-1"))[0]?.status).toBe("FAILED");
    expect(repo.balanceOf("user-1")).toEqual({ availableUnits: 500, reservedUnits: 0 });
    expect(repo.auditCount("withdrawal.failed")).toBe(1);
  });
});
