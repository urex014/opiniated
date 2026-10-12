import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemoryRewardStore } from "@/lib/rewards/memory-store";
import { processCpxPostback, type CpxPostbackInput } from "@/lib/survey-providers/providers/cpx/callback";
import type { CpxPostbackParams } from "@/lib/survey-providers/providers/cpx/validation";

const secret = "app-secure-hash";

function hashFor(transId: string, key = secret): string {
  return createHash("md5").update(`${transId}-${key}`).digest("hex");
}

function input(partial: Partial<CpxPostbackParams> = {}, secureHash = secret): CpxPostbackInput {
  const trans_id = partial.trans_id === undefined ? "tx-1" : partial.trans_id;
  const params: CpxPostbackParams = {
    status: "1",
    user_id: "user-1",
    amount_local: "0.80",
    amount_usd: "0.40",
    offer_id: "offer-9",
    ip_click: "198.51.100.20",
    ...partial,
    trans_id,
  };
  if (trans_id && params.secure_hash === undefined) params.secure_hash = hashFor(trans_id, secureHash);
  return { secureHash, params, currencyCode: "OPN", minorUnitFactor: 100 };
}

describe("CPX postbacks", () => {
  it("credits amount_local once and ignores the publisher revenue and a duplicate", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const first = await processCpxPostback(store, input({ amount_usd: "9.99" }));
    const second = await processCpxPostback(store, input({ amount_usd: "9.99" }));
    expect(first).toMatchObject({ httpStatus: 200, outcome: "ACCEPTED" });
    expect(second).toMatchObject({ httpStatus: 200, outcome: "DUPLICATE" });
    expect(store.balance("user-1")).toBe(80);
    expect(store.recorded()).toEqual([
      expect.objectContaining({ provider: "cpx", providerTxId: "tx-1", type: "COMPLETE", amountUnits: 80, providerUsd: "9.99" }),
    ]);
  });

  it("rejects a bad or missing hash without crediting", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const bad = await processCpxPostback(store, input({ secure_hash: "f".repeat(32) }));
    const missing = await processCpxPostback(store, input({ secure_hash: "" }));
    expect(bad).toMatchObject({ httpStatus: 401, outcome: "INVALID_SIGNATURE" });
    expect(missing).toMatchObject({ httpStatus: 401, outcome: "INVALID_SIGNATURE" });
    expect(store.balance("user-1")).toBe(0);
    expect(store.transactionCount()).toBe(0);
  });

  it("fails closed when the secure hash is not configured", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processCpxPostback(store, input({}, "  "));
    expect(result).toMatchObject({ httpStatus: 500, outcome: "INTERNAL_FAILURE" });
    expect(store.balance("user-1")).toBe(0);
  });

  it("rejects a missing transaction id as a payload error", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processCpxPostback(store, input({ trans_id: "", secure_hash: hashFor("tx-1") }));
    expect(result).toMatchObject({ httpStatus: 400, outcome: "INVALID_PAYLOAD" });
    expect(store.balance("user-1")).toBe(0);
  });

  it("rejects missing fields, zero, negative, and non-decimal amounts", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const cases = [
      input({ user_id: "" }),
      input({ status: "" }),
      input({ amount_local: "" }),
      input({ amount_local: "0" }),
      input({ amount_local: "-0.20" }),
      input({ amount_local: "1.00 USD" }),
      input({ amount_local: "10EUR" }),
    ];
    for (const entry of cases) {
      const result = await processCpxPostback(store, entry);
      expect(result).toMatchObject({ httpStatus: 400, outcome: "INVALID_PAYLOAD" });
    }
    expect(store.balance("user-1")).toBe(0);
  });

  it("does not credit another account from this callback", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processCpxPostback(store, input({ user_id: "user-2", trans_id: "tx-other" }));
    expect(result).toMatchObject({ httpStatus: 200, outcome: "UNKNOWN_USER" });
    expect(store.balance("user-1")).toBe(0);
    expect(store.balance("user-2")).toBe(0);
  });

  it("acknowledges an unsupported status without crediting", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processCpxPostback(store, input({ status: "3", trans_id: "tx-odd" }));
    expect(result).toMatchObject({ httpStatus: 200, outcome: "UNSUPPORTED_EVENT" });
    expect(store.balance("user-1")).toBe(0);
    expect(store.transactionCount()).toBe(0);
  });

  it("keeps two different callbacks and ignores a concurrent duplicate", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const [first, second] = await Promise.all([
      processCpxPostback(store, input({ trans_id: "tx-a", amount_local: "0.40" })),
      processCpxPostback(store, input({ trans_id: "tx-b", amount_local: "0.25" })),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(["ACCEPTED", "ACCEPTED"]);
    expect(store.balance("user-1")).toBe(65);

    const raced = input({ trans_id: "tx-race", amount_local: "0.50" });
    const [credit, duplicate] = await Promise.all([processCpxPostback(store, raced), processCpxPostback(store, raced)]);
    expect([credit.outcome, duplicate.outcome].sort()).toEqual(["ACCEPTED", "DUPLICATE"]);
    expect(store.balance("user-1")).toBe(115);
  });

  it("reverses a reused transaction id without deleting the credit or going negative", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    await processCpxPostback(store, input({ trans_id: "tx-c", amount_local: "0.30" }));
    const reversal = await processCpxPostback(store, input({ trans_id: "tx-c", status: "2", amount_local: "0.50" }));
    const replay = await processCpxPostback(store, input({ trans_id: "tx-c", status: "2", amount_local: "0.50" }));
    expect(reversal).toMatchObject({ httpStatus: 200, outcome: "ACCEPTED" });
    expect(replay.outcome).toBe("DUPLICATE");
    expect(store.balance("user-1")).toBe(0);
    expect(store.recorded().map((row) => row.providerTxId)).toEqual(["tx-c", "tx-c:reversal"]);
  });

  it("reverses a distinct transaction id and a negative amount_local once", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    await processCpxPostback(store, input({ trans_id: "tx-d", amount_local: "1.00" }));
    const reversal = await processCpxPostback(store, input({ trans_id: "tx-d-r", status: "2", amount_local: "-0.40" }));
    expect(reversal.outcome).toBe("ACCEPTED");
    expect(store.balance("user-1")).toBe(60);
    expect(store.recorded().map((row) => row.providerTxId)).toContain("tx-d-r:reversal");
  });

  it("still credits a valid amount_local when amount_usd is not a decimal, and ignores ip_click", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processCpxPostback(store, input({ amount_usd: "9.99 USD", ip_click: "0.0.0.0", trans_id: "tx-ip" }));
    expect(result.outcome).toBe("ACCEPTED");
    expect(store.balance("user-1")).toBe(80);
    expect(store.recorded()[0]?.providerUsd).toBeNull();
  });
});
