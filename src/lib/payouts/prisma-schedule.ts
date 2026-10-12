import { prisma } from "@/lib/db";
import { OPEN_WITHDRAWAL_STATUSES } from "@/lib/payouts/constants";
import { DEFAULT_MIN_USD_CENTS } from "@/lib/payouts/eligibility";
import type { PayoutCandidate } from "@/lib/payouts/enroll";
import type { AutoPayoutStore, FxPolicy, ScheduleState } from "@/lib/payouts/cycle";
import { parseFxPolicy, parseScheduleSettings } from "@/lib/payouts/schedule-policy";

const SCHEDULE_KEY = "auto";

function toState(row: { intervalDays: number; minUsdCents: number; nextRunAt: Date; paused: boolean; lockedUntil: Date }): ScheduleState {
  return {
    intervalDays: row.intervalDays,
    minUsdCents: row.minUsdCents,
    nextRunAt: row.nextRunAt,
    paused: row.paused,
    lockedUntil: row.lockedUntil,
  };
}

export class PrismaAutoPayoutStore implements AutoPayoutStore {
  async tryLock(now: Date, holdMs: number): Promise<ScheduleState | null> {
    await prisma.payoutSchedule.upsert({
      where: { key: SCHEDULE_KEY },
      create: {
        key: SCHEDULE_KEY,
        intervalDays: 7,
        minUsdCents: DEFAULT_MIN_USD_CENTS,
        nextRunAt: now,
        paused: true,
        lockedUntil: new Date(0),
      },
      update: {},
    });
    const updated = await prisma.payoutSchedule.updateMany({
      where: { key: SCHEDULE_KEY, lockedUntil: { lte: now } },
      data: { lockedUntil: new Date(now.getTime() + holdMs) },
    });
    if (updated.count !== 1) return null;
    const row = await prisma.payoutSchedule.findUnique({ where: { key: SCHEDULE_KEY } });
    return row ? toState(row) : null;
  }

  async finishLock(nextRunAt: Date | null): Promise<void> {
    await prisma.payoutSchedule.update({
      where: { key: SCHEDULE_KEY },
      data: { lockedUntil: new Date(0), ...(nextRunAt ? { nextRunAt } : {}) },
    });
  }

  async activeFx(now: Date): Promise<FxPolicy | null> {
    const row = await prisma.payoutFxPolicy.findFirst({
      where: { effectiveAt: { lte: now }, expiresAt: { gt: now } },
      orderBy: { effectiveAt: "desc" },
    });
    if (!row) return null;
    return { nairaPerUsd: row.nairaPerUsd, effectiveAt: row.effectiveAt, expiresAt: row.expiresAt };
  }

  async listCandidates(minUsdCents: number, limit: number): Promise<PayoutCandidate[]> {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        payoutAccount: { isNot: null },
        rewardAccount: { is: { availableUnits: { gte: minUsdCents } } },
        withdrawals: { none: { status: { in: [...OPEN_WITHDRAWAL_STATUSES] } } },
      },
      include: { payoutAccount: true, rewardAccount: true },
      orderBy: { createdAt: "asc" },
      take: Math.max(limit, 1) * 4,
    });
    const ready: PayoutCandidate[] = [];
    for (const user of users) {
      if (!user.rewardAccount || !user.payoutAccount) continue;
      const spendable = user.rewardAccount.availableUnits - user.rewardAccount.reservedUnits;
      if (spendable < minUsdCents) continue;
      ready.push({
        userId: user.id,
        email: user.email,
        deletedAt: user.deletedAt,
        availableUnits: user.rewardAccount.availableUnits,
        reservedUnits: user.rewardAccount.reservedUnits,
        accountUpdatedAt: user.payoutAccount.updatedAt,
        recipientCode: user.payoutAccount.recipientCode,
        openWithdrawal: false,
      });
      if (ready.length >= limit) break;
    }
    return ready;
  }
}

export async function readSchedule(now: Date): Promise<ScheduleState> {
  const row = await prisma.payoutSchedule.findUnique({ where: { key: SCHEDULE_KEY } });
  if (row) return toState(row);
  return { intervalDays: 7, minUsdCents: DEFAULT_MIN_USD_CENTS, nextRunAt: now, paused: true, lockedUntil: new Date(0) };
}

export async function setSchedulePaused(paused: boolean, actorId: string): Promise<void> {
  const now = new Date();
  await prisma.payoutSchedule.upsert({
    where: { key: SCHEDULE_KEY },
    create: { key: SCHEDULE_KEY, intervalDays: 7, minUsdCents: DEFAULT_MIN_USD_CENTS, nextRunAt: now, paused, lockedUntil: new Date(0) },
    update: { paused },
  });
  await prisma.payoutAudit.create({ data: { actorId, action: paused ? "schedule.paused" : "schedule.resumed" } });
}

export async function saveScheduleSettings(input: { intervalDays: number; minUsdCents: number; actorId: string }): Promise<{ error?: string; message?: string }> {
  const parsed = parseScheduleSettings(input);
  if (!parsed.ok) return { error: parsed.error };
  const now = new Date();
  await prisma.payoutSchedule.upsert({
    where: { key: SCHEDULE_KEY },
    create: {
      key: SCHEDULE_KEY,
      intervalDays: parsed.intervalDays,
      minUsdCents: parsed.minUsdCents,
      nextRunAt: now,
      paused: true,
      lockedUntil: new Date(0),
    },
    update: { intervalDays: parsed.intervalDays, minUsdCents: parsed.minUsdCents },
  });
  await prisma.payoutAudit.create({
    data: { actorId: input.actorId, action: "schedule.updated", detail: `${parsed.intervalDays} days, ${parsed.minUsdCents} cents` },
  });
  return { message: "Payout schedule saved." };
}

export async function saveFxPolicy(input: { nairaPerUsd: number; validForDays: number; note: string; actorId: string; now: Date }): Promise<{ error?: string; message?: string }> {
  const parsed = parseFxPolicy(input);
  if (!parsed.ok) return { error: parsed.error };
  await prisma.payoutFxPolicy.create({
    data: {
      nairaPerUsd: parsed.nairaPerUsd,
      effectiveAt: parsed.effectiveAt,
      expiresAt: parsed.expiresAt,
      actorId: input.actorId,
      note: input.note.trim().slice(0, 200) || null,
    },
  });
  await prisma.payoutAudit.create({
    data: { actorId: input.actorId, action: "fx.recorded", detail: `${parsed.nairaPerUsd} naira per dollar until ${parsed.expiresAt.toISOString()}` },
  });
  return { message: "Currency rate saved for future batches." };
}

export const prismaAutoPayouts = new PrismaAutoPayoutStore();
