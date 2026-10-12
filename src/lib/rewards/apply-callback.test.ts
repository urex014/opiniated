import { describe, expect, it } from "vitest";
import { assertSameUser } from "@/lib/auth/authorize";
import { applyValidatedCallback } from "@/lib/rewards/apply-callback";
import { MemoryRewardStore } from "@/lib/rewards/memory-store";
import type { ValidatedCallback } from "@/lib/rewards/types";

function event(overrides: Partial<ValidatedCallback> = {}): ValidatedCallback {
  return {
    provider: "cpx",
    userId: "user-1",
    providerTxId: "tx-1",
    type: "COMPLETE",
    amountUnits: 40,
    currencyCode: "OPN",
    surveyId: "survey-1",
    refTxId: null,
    reason: null,
    providerUsd: null,
    disposition: "reward",
    ...overrides,
  };
}

describe("shared reward application", () => {
  it("records a screen-out without crediting a reward", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await applyValidatedCallback(
      store,
      event({ type: "SCREENOUT", amountUnits: 0, providerTxId: "screen" }),
    );
    expect(result).toMatchObject({ httpStatus: 200, outcome: "ACCEPTED" });
    expect(store.balance("user-1")).toBe(0);
    expect(store.transactionCount()).toBe(0);
  });

  it("credits a positive reconciliation on top of the balance", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    const result = await applyValidatedCallback(store, event({ type: "RECONCILIATION", amountUnits: 15, providerTxId: "plus" }));
    expect(result.outcome).toBe("ACCEPTED");
    expect(store.balance("user-1")).toBe(15);
  });

  it("keeps the same external id for two providers, including a historical row", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    await applyValidatedCallback(store, event({ provider: "bitlabs", providerTxId: "shared", amountUnits: 10 }));
    await applyValidatedCallback(store, event({ provider: "cpx", providerTxId: "shared", amountUnits: 25 }));
    expect(store.balance("user-1")).toBe(35);
    expect(store.recorded().map((row) => row.provider).sort()).toEqual(["bitlabs", "cpx"]);
    expect(store.recorded().every((row) => row.providerTxId === "shared")).toBe(true);
  });

  it("leaves the balance unchanged when the database transaction fails", async () => {
    const store = new MemoryRewardStore();
    store.ensureAccount("user-1");
    store.failBeforeCommit = true;
    await expect(applyValidatedCallback(store, event())).rejects.toThrow(/database transaction failed/);
    expect(store.balance("user-1")).toBe(0);
    expect(store.transactionCount()).toBe(0);
  });

  it("does not let one account read another account's id", () => {
    expect(() => assertSameUser("user-1", "user-2")).toThrow(/another account/);
    expect(() => assertSameUser("user-1", "user-1")).not.toThrow();
  });
});
