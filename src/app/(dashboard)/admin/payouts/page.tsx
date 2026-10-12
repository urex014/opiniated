import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { AdminWithdrawalActions, CreateBatchForm } from "@/components/payouts/admin-controls";
import { AdminPayoutBoard } from "@/components/payouts/admin-payout-board";
import { AdminScheduleForm } from "@/components/payouts/admin-schedule";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { paystackKeyMode } from "@/lib/paystack/mode";
import { isAdminEmail } from "@/lib/payouts/access";
import { OPEN_WITHDRAWAL_STATUSES, isWithdrawalStatus } from "@/lib/payouts/constants";
import { withdrawalStatusLabel } from "@/lib/payouts/labels";
import { prismaPayouts } from "@/lib/payouts/prisma-repository";
import { prismaAutoPayouts, readSchedule } from "@/lib/payouts/prisma-schedule";
import { loadAdminPayoutBoard } from "@/lib/payouts/review-list";
import { riskFlags } from "@/lib/payouts/risk";
import { formatReward } from "@/lib/rewards/money";

export const metadata: Metadata = { title: "Payout admin" };
export const instant = false;

export default async function AdminPayoutsPage() {
  await io();
  const user = await requireUser();
  const env = readEnv();
  if (!isAdminEmail(user.email, env.adminEmails)) notFound();
  const now = new Date();
  const schedule = await readSchedule(now);
  const [withdrawals, paidRows, fx] = await Promise.all([
    prismaPayouts.listRecent(100),
    prisma.withdrawal.findMany({
      where: { status: { in: ["PAID", "REVERSED"] } },
      select: { userId: true },
    }),
    prismaAutoPayouts.activeFx(now),
  ]);
  const board = await loadAdminPayoutBoard({
    now,
    currencyCode: env.rewardCurrencyCode,
    factor: env.rewardMinorUnitFactor,
    minUsdCents: schedule.minUsdCents,
    minimumKobo: env.payoutMinKobo,
    nairaPerUsd: fx?.nairaPerUsd ?? null,
    rateExpiresAt: fx?.expiresAt ?? null,
  });
  const paidCount = new Map<string, number>();
  for (const row of paidRows) paidCount.set(row.userId, (paidCount.get(row.userId) ?? 0) + 1);
  const mode = paystackKeyMode(env.paystackSecretKey);

  return (
    <>
      <h1 className="page-title">Payout admin</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Paystack mode: {mode}. Transfers {env.paystackTransfersEnabled ? "can be released by an admin" : "are turned off"}.
        {mode === "live" && !env.paystackLiveConfirmed ? " Live sending still needs a separate confirmation." : ""}{" "}
        {schedule.paused ? "Release is paused." : "Release is allowed after confirmation."} No scheduled job sends money.
        Bulk transfers spend the Paystack balance. Survey callbacks do not fund that balance. Paystack requires OTP
        approval to be disabled for bulk transfers. This application does not change that setting.
      </p>
      <div className="mt-5">
        <AdminScheduleForm
          paused={schedule.paused}
          intervalDays={schedule.intervalDays}
          minUsdCents={schedule.minUsdCents}
          rateLabel={fx ? `${fx.nairaPerUsd} naira per dollar until ${fx.expiresAt.toISOString()}.` : "No unexpired naira rate is saved."}
        />
      </div>
      <div className="mt-5">
        <CreateBatchForm />
      </div>
      <AdminPayoutBoard recipients={board.recipients} batches={board.batches} />

      <h2 className="section-title mb-3 mt-8">Withdrawals</h2>
      <ul className="grid gap-3">
        {withdrawals.map((row) => {
          if (!isWithdrawalStatus(row.status)) return null;
          const open = (OPEN_WITHDRAWAL_STATUSES as readonly string[]).includes(row.status);
          const flags = open
            ? riskFlags({
                points: row.points,
                spendableBefore: row.availableUnits,
                accountUpdatedAt: row.accountUpdatedAt,
                paidCount: paidCount.get(row.userId) ?? 0,
                now,
              })
            : [];
          return (
            <li key={row.id} className="rounded-lg border border-line bg-white px-4 py-3">
              <p className="font-medium">
                {row.userEmail} · {formatReward(row.points, env.rewardCurrencyCode, env.rewardMinorUnitFactor)} ·{" "}
                {formatReward(row.amountKobo, "NGN", 100)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {withdrawalStatusLabel(row.status)}
                {row.bankName ? ` · ${row.bankName} ending ${row.accountLast4}` : ""}
                {row.accountName ? ` · ${row.accountName}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted">
                Reference {row.reference}
                {row.transferCode ? ` · ${row.transferCode}` : ""}
                {row.batchStatus ? ` · batch ${row.batchStatus}` : ""}
              </p>
              {row.failureReason ? <p className="mt-1 text-sm text-danger">{row.failureReason}</p> : null}
              {row.anomaly ? <p className="mt-1 text-sm text-danger">Flagged: {row.anomaly}</p> : null}
              {flags.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                  {flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : null}
              <AdminWithdrawalActions id={row.id} status={row.status} batchStatus={row.batchStatus} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
