import type { Metadata } from "next";
import { io } from "next/cache";
import { BankForm } from "@/components/payouts/payout-forms";
import { EarningsPanel } from "@/components/payouts/earnings-panel";
import { WithdrawalHistory } from "@/components/payouts/payout-summary";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { createPaystackClient } from "@/lib/paystack/client";
import { OPEN_WITHDRAWAL_STATUSES, isWithdrawalStatus } from "@/lib/payouts/constants";
import { BANK_HOLD_MS, evaluateEligibility, payoutNotice, payoutProgress } from "@/lib/payouts/eligibility";
import { prismaAutoPayouts, readSchedule } from "@/lib/payouts/prisma-schedule";
import { prismaPayouts } from "@/lib/payouts/prisma-repository";
import { payoutHeld } from "@/lib/risk/persist";

export const metadata: Metadata = { title: "Payouts" };
export const instant = false;

export default async function PayoutsPage() {
  await io();
  const user = await requireUser();
  const env = readEnv();
  const now = new Date();
  const [account, payout, withdrawals, banks, schedule, fx, held] = await Promise.all([
    prisma.rewardAccount.findUnique({ where: { userId: user.id } }),
    prismaPayouts.getPayoutAccount(user.id),
    prismaPayouts.listForUser(user.id),
    loadBanks(),
    readSchedule(now),
    prismaAutoPayouts.activeFx(now),
    payoutHeld(user.id),
  ]);
  const available = account?.availableUnits ?? 0;
  const reserved = account?.reservedUnits ?? 0;
  const spendable = Math.max(0, available - reserved);
  const open = withdrawals.find((row) => (OPEN_WITHDRAWAL_STATUSES as readonly string[]).includes(row.status));
  const phase = open?.status === "PROCESSING" ? "processing" : open ? "scheduled" : withdrawals.some((row) => row.status === "PAID") ? "paid" : "none";
  const hasBank = Boolean(payout?.recipientCode.startsWith("RCP_"));
  const bankReady = Boolean(payout && hasBank && now.getTime() - payout.updatedAt.getTime() >= BANK_HOLD_MS);
  const decision = evaluateEligibility({
    deletedAt: null,
    availableUnits: available,
    reservedUnits: reserved,
    accountUpdatedAt: payout?.updatedAt ?? null,
    recipientCode: payout?.recipientCode ?? null,
    openWithdrawal: Boolean(open),
    currencyCode: env.rewardCurrencyCode,
    nairaPerUsd: fx?.nairaPerUsd ?? null,
    rateExpiresAt: fx?.expiresAt ?? null,
    now,
    minUsdCents: schedule.minUsdCents,
    minimumKobo: env.payoutMinKobo,
    payoutHeld: held,
  });
  const history = withdrawals.flatMap((row) =>
    isWithdrawalStatus(row.status)
      ? [{ id: row.id, requestedAt: row.requestedAt, points: row.points, amountKobo: row.amountKobo, status: row.status, failureReason: row.failureReason }]
      : [],
  );

  return (
    <>
      <h1 className="page-title">Payouts</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Eligible balances are reserved into a reviewed batch and paid to a verified Nigerian bank account. You do not
        request a withdrawal. A reservation is not a payment until Paystack confirms the transfer.
      </p>
      <div className="mt-5">
        <EarningsPanel
          earnedUnits={account?.lifetimeCreditedUnits ?? 0}
          spendableUnits={spendable}
          reservedUnits={reserved}
          minUsdCents={schedule.minUsdCents}
          progress={payoutProgress(spendable, schedule.minUsdCents)}
          notice={held
            ? "Your payout is paused while this account is reviewed. Your balance stays in the account. Contact support if you think this is a mistake."
            : payoutNotice({
            hasVerifiedBank: hasBank,
            bankReady,
            phase,
            spendableUnits: spendable,
            minUsdCents: schedule.minUsdCents,
            currencyCode: env.rewardCurrencyCode,
            aboveTransferMax: !decision.ok && decision.reason === "above_paystack_max",
            belowTransferMin: !decision.ok && decision.reason === "below_paystack_min",
          })}
          currencyCode={env.rewardCurrencyCode}
          factor={env.rewardMinorUnitFactor}
          bankLabel={bankLabel(payout, bankReady)}
          nextBatch={schedule.paused ? "Payout batches are paused. Your balance stays in your account." : "An administrator reviews eligible balances before any transfer. Reaching the minimum does not send money by itself."}
        />
      </div>

      <section className="mt-8">
        <h2 className="section-title">Bank account</h2>
        <div className="mt-3">
          {banks.ok ? (
            <BankForm banks={banks.banks} saved={payout ? { bankName: payout.bankName, accountLast4: payout.accountLast4, accountName: payout.accountName } : null} />
          ) : (
            <p className="text-sm leading-6 text-muted">{banks.message}</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="section-title mb-3">Payout history</h2>
        <WithdrawalHistory rows={history} currencyCode={env.rewardCurrencyCode} factor={env.rewardMinorUnitFactor} />
      </section>
    </>
  );
}

function bankLabel(payout: { bankName: string; accountLast4: string; accountName: string } | null, ready: boolean): string {
  if (!payout) return "No bank account is connected.";
  const saved = `${payout.bankName} ending ${payout.accountLast4}, ${payout.accountName}.`;
  return ready ? `Verified bank account: ${saved}` : `Saved bank account: ${saved}`;
}

async function loadBanks(): Promise<{ ok: true; banks: { name: string; code: string }[] } | { ok: false; message: string }> {
  const env = readEnv();
  if (!env.paystackSecretKey) return { ok: false, message: "Bank verification is not configured." };
  const client = createPaystackClient({ secretKey: env.paystackSecretKey, baseUrl: env.paystackBaseUrl });
  return client.listBanks();
}
