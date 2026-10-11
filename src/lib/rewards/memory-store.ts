import { planReward } from "@/lib/rewards/planner";
import type { AccountState } from "@/lib/rewards/planner";
import type { ApplyResult, RewardStore, ValidatedCallback } from "@/lib/rewards/types";

type StoredTransaction = ValidatedCallback & {
  appliedUnits: number;
  shortfallUnits: number;
  status: string;
};

type Snapshot = {
  accounts: Map<string, AccountState>;
  processed: Map<string, string>;
  transactions: StoredTransaction[];
  activities: Array<{ userId: string; surveyId: string; status: string }>;
};

export class MemoryRewardStore implements RewardStore {
  users = new Set<string>();
  private state: Snapshot = {
    accounts: new Map(),
    processed: new Map(),
    transactions: [],
    activities: [],
  };
  private chain: Promise<void> = Promise.resolve();
  failBeforeCommit = false;

  ensureAccount(userId: string): void {
    this.users.add(userId);
    if (!this.state.accounts.has(userId)) {
      this.state.accounts.set(userId, { availableUnits: 0, lifetimeCreditedUnits: 0 });
    }
  }

  balance(userId: string): number {
    return this.state.accounts.get(userId)?.availableUnits ?? 0;
  }

  transactionCount(): number {
    return this.state.transactions.length;
  }

  async apply(event: ValidatedCallback): Promise<ApplyResult> {
    const run = this.chain.then(() => this.applyUnlocked(event));
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async recordRejection(): Promise<void> {
    return;
  }

  private async applyUnlocked(event: ValidatedCallback): Promise<ApplyResult> {
    const next = cloneState(this.state);
    const key = `bitlabs:${event.providerTxId}`;
    if (next.processed.has(key)) return { outcome: "DUPLICATE" };
    if (!this.users.has(event.userId)) {
      next.processed.set(key, "UNKNOWN_USER");
      if (this.failBeforeCommit) throw new Error("database transaction failed");
      this.state = next;
      return { outcome: "UNKNOWN_USER" };
    }
    if (event.disposition === "unsupported") {
      next.processed.set(key, "UNSUPPORTED_EVENT");
      if (this.failBeforeCommit) throw new Error("database transaction failed");
      this.state = next;
      return { outcome: "UNSUPPORTED_EVENT" };
    }
    const account = next.accounts.get(event.userId) ?? { availableUnits: 0, lifetimeCreditedUnits: 0 };
    const plan = planReward(account, event.type, event.amountUnits);
    next.processed.set(key, "ACCEPTED");
    if (event.type !== "SCREENOUT") {
      next.transactions.push({
        ...event,
        appliedUnits: plan.appliedUnits,
        shortfallUnits: plan.shortfallUnits,
        status: plan.status,
      });
      next.accounts.set(event.userId, plan.next);
    }
    if (event.surveyId) {
      next.activities.push({
        userId: event.userId,
        surveyId: event.surveyId,
        status: activityStatus(event.type),
      });
    }
    if (this.failBeforeCommit) throw new Error("database transaction failed");
    this.state = next;
    return { outcome: "ACCEPTED", availableUnits: plan.next.availableUnits };
  }
}

function activityStatus(type: ValidatedCallback["type"]): string {
  if (type === "SCREENOUT") return "SCREENED_OUT";
  if (type === "RECONCILIATION") return "RECONCILED";
  return "COMPLETED";
}

function cloneState(state: Snapshot): Snapshot {
  return {
    accounts: new Map(
      [...state.accounts.entries()].map(([id, account]) => [id, { ...account }]),
    ),
    processed: new Map(state.processed),
    transactions: [...state.transactions],
    activities: [...state.activities],
  };
}
