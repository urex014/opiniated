import { OPEN_WITHDRAWAL_STATUSES } from "@/lib/payouts/constants";
import { DEFAULT_MIN_USD_CENTS } from "@/lib/payouts/eligibility";
import type { PayoutCandidate } from "@/lib/payouts/enroll";
import type { AutoPayoutStore, FxPolicy, ScheduleState } from "@/lib/payouts/cycle";
import type { PayoutRepository } from "@/lib/payouts/repository";

export class MemoryAutoPayoutStore implements AutoPayoutStore {
  candidates: PayoutCandidate[] = [];
  policies: FxPolicy[] = [];
  intervalDays = 7;
  minUsdCents = DEFAULT_MIN_USD_CENTS;
  nextRunAt: Date;
  paused = true;
  private lockedUntil = new Date(0);
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private repo: PayoutRepository,
    now: Date,
  ) {
    this.nextRunAt = now;
  }

  private exclusive<T>(work: () => T): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  snapshot(): ScheduleState {
    return {
      intervalDays: this.intervalDays,
      minUsdCents: this.minUsdCents,
      nextRunAt: this.nextRunAt,
      paused: this.paused,
      lockedUntil: this.lockedUntil,
    };
  }

  async tryLock(now: Date, holdMs: number): Promise<ScheduleState | null> {
    return this.exclusive(() => {
      if (this.lockedUntil.getTime() > now.getTime()) return null;
      this.lockedUntil = new Date(now.getTime() + holdMs);
      return this.snapshot();
    });
  }

  async finishLock(nextRunAt: Date | null): Promise<void> {
    return this.exclusive(() => {
      if (nextRunAt) this.nextRunAt = nextRunAt;
      this.lockedUntil = new Date(0);
    });
  }

  async activeFx(now: Date): Promise<FxPolicy | null> {
    const live = this.policies
      .filter((policy) => policy.effectiveAt.getTime() <= now.getTime() && policy.expiresAt.getTime() > now.getTime())
      .sort((left, right) => right.effectiveAt.getTime() - left.effectiveAt.getTime());
    return live[0] ?? null;
  }

  async listCandidates(minUsdCents: number, limit: number): Promise<PayoutCandidate[]> {
    const recent = await this.repo.listRecent(1000);
    const open = new Set(recent.filter((row) => (OPEN_WITHDRAWAL_STATUSES as readonly string[]).includes(row.status)).map((row) => row.userId));
    return this.candidates
      .filter((candidate) => !open.has(candidate.userId) && !candidate.openWithdrawal && candidate.availableUnits - candidate.reservedUnits >= minUsdCents)
      .slice(0, limit);
  }
}
