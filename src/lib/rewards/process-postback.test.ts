import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemoryRewardStore } from "@/lib/rewards/memory-store";
import { processPostback, type PostbackParams } from "@/lib/rewards/process-postback";
import { assertSameUser } from "@/lib/auth/authorize";

const secret = "test-secret";

function signed(params: PostbackParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const unsigned = `https://opiniated.example/api/bitlabs/postback?${search.toString()}`;
  const hash = createHmac("sha1", secret).update(unsigned).digest("hex");
  return `${unsigned}&hash=${hash}`;
}

function input(params: PostbackParams, fullUrl = signed(params)) {
  return {
    fullUrl,
    secret,
    params,
    currencyCode: "PTS",
    minorUnitFactor: 1,
  };
}

describe("reward postbacks", () => {
  it("credits a valid completion once and ignores the duplicate", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const params = { uid: "user-1", tx: "tx-1", val: "80", type: "COMPLETE", survey_id: "survey-9" };
    const first = await processPostback(store, input(params));
    const second = await processPostback(store, input(params));
    expect(first).toMatchObject({ httpStatus: 200, outcome: "ACCEPTED" });
    expect(second).toMatchObject({ httpStatus: 200, outcome: "DUPLICATE" });
    expect(store.balance("user-1")).toBe(80);
    expect(store.transactionCount()).toBe(1);
  });

  it("rejects an invalid signature without crediting", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const params = { uid: "user-1", tx: "tx-2", val: "80", type: "COMPLETE" };
    const result = await processPostback(store, input(params, `${signed(params)}nope`));
    expect(result).toMatchObject({ httpStatus: 401, outcome: "INVALID_SIGNATURE" });
    expect(store.balance("user-1")).toBe(0);
  });

  it("rejects an unknown user without creating a balance", async () => {
    const store = new MemoryRewardStore();
    const result = await processPostback(
      store,
      input({ uid: "missing", tx: "tx-3", val: "40", type: "COMPLETE" }),
    );
    expect(result).toMatchObject({ httpStatus: 200, outcome: "UNKNOWN_USER" });
    expect(store.balance("missing")).toBe(0);
    expect(store.transactionCount()).toBe(0);
  });

  it("rejects an invalid amount", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processPostback(
      store,
      input({ uid: "user-1", tx: "tx-4", val: "-5", type: "COMPLETE" }),
    );
    expect(result).toMatchObject({ httpStatus: 400, outcome: "INVALID_PAYLOAD" });
    expect(store.balance("user-1")).toBe(0);
  });

  it("records a screen-out without crediting a reward", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processPostback(
      store,
      input({ uid: "user-1", tx: "tx-screen", val: "10", type: "SCREENOUT", survey_id: "survey-1" }),
    );
    expect(result).toMatchObject({ httpStatus: 200, outcome: "ACCEPTED" });
    expect(store.balance("user-1")).toBe(0);
    expect(store.transactionCount()).toBe(0);
  });

  it("acknowledges an unsupported event without crediting", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processPostback(
      store,
      input({ uid: "user-1", tx: "tx-5", val: "20", type: "OFFER" }),
    );
    expect(result).toMatchObject({ httpStatus: 200, outcome: "UNSUPPORTED_EVENT" });
    expect(store.balance("user-1")).toBe(0);
  });

  it("keeps the ledger consistent when two different callbacks arrive together", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const [first, second] = await Promise.all([
      processPostback(store, input({ uid: "user-1", tx: "tx-a", val: "40", type: "COMPLETE" })),
      processPostback(store, input({ uid: "user-1", tx: "tx-b", val: "25", type: "COMPLETE" })),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(["ACCEPTED", "ACCEPTED"]);
    expect(store.balance("user-1")).toBe(65);
    expect(store.transactionCount()).toBe(2);
  });

  it("does not double-credit concurrent duplicate callbacks", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const params = { uid: "user-1", tx: "tx-race", val: "50", type: "COMPLETE" };
    const [first, second] = await Promise.all([
      processPostback(store, input(params)),
      processPostback(store, input(params)),
    ]);
    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["ACCEPTED", "DUPLICATE"]);
    expect(store.balance("user-1")).toBe(50);
  });

  it("credits a positive reconciliation on top of the balance", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await processPostback(
      store,
      input({ uid: "user-1", tx: "tx-plus", val: "15", type: "RECONCILIATION" }),
    );
    expect(result.outcome).toBe("ACCEPTED");
    expect(store.balance("user-1")).toBe(15);
  });

  it("records a reversal without deleting history or going negative", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    await processPostback(store, input({ uid: "user-1", tx: "tx-c", val: "30", type: "COMPLETE" }));
    const reversal = await processPostback(
      store,
      input({ uid: "user-1", tx: "rtx-c", val: "-50", type: "RECONCILIATION", ref: "tx-c" }),
    );
    expect(reversal.outcome).toBe("ACCEPTED");
    expect(store.balance("user-1")).toBe(0);
    expect(store.transactionCount()).toBe(2);
  });

  it("leaves the balance unchanged when the database transaction fails", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    store.failBeforeCommit = true;
    await expect(
      processPostback(store, input({ uid: "user-1", tx: "tx-fail", val: "25", type: "COMPLETE" })),
    ).rejects.toThrow(/database transaction failed/);
    expect(store.balance("user-1")).toBe(0);
    expect(store.transactionCount()).toBe(0);
  });

  it("does not let one account read another account's id", () => {
    expect(() => assertSameUser("user-1", "user-2")).toThrow(/another account/);
    expect(() => assertSameUser("user-1", "user-1")).not.toThrow();
  });
});
