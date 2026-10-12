import { FX_MAX_DAYS } from "@/lib/payouts/eligibility";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseScheduleSettings(input: { intervalDays: number; minUsdCents: number }): { ok: true; intervalDays: number; minUsdCents: number } | { ok: false; error: string } {
  if (!Number.isInteger(input.intervalDays) || input.intervalDays < 1 || input.intervalDays > 90) {
    return { ok: false, error: "The batch interval must be a whole number of days from 1 to 90." };
  }
  if (!Number.isInteger(input.minUsdCents) || input.minUsdCents < 100 || input.minUsdCents > 100_000) {
    return { ok: false, error: "The minimum payout must be a whole number of cents from 100 to 100000." };
  }
  return { ok: true, intervalDays: input.intervalDays, minUsdCents: input.minUsdCents };
}

export function parseFxPolicy(input: { nairaPerUsd: number; validForDays: number; now: Date }): { ok: true; nairaPerUsd: number; effectiveAt: Date; expiresAt: Date } | { ok: false; error: string } {
  if (!Number.isInteger(input.nairaPerUsd) || input.nairaPerUsd < 1) {
    return { ok: false, error: "Enter a whole number of naira per dollar." };
  }
  if (!Number.isInteger(input.validForDays) || input.validForDays < 1 || input.validForDays > FX_MAX_DAYS) {
    return { ok: false, error: `The rate must expire within ${FX_MAX_DAYS} days.` };
  }
  return {
    ok: true,
    nairaPerUsd: input.nairaPerUsd,
    effectiveAt: input.now,
    expiresAt: new Date(input.now.getTime() + input.validForDays * DAY_MS),
  };
}
