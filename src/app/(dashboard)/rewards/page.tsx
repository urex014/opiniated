import type { Metadata } from "next";
import { RewardSummary } from "@/components/rewards/reward-summary";
import { TransactionTable } from "@/components/rewards/transaction-table";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { rewardUnitExplanation, rewardUnitName } from "@/lib/rewards/currency";
import { listTransactions } from "@/lib/rewards/queries";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Rewards" };
export const instant = false;

export default async function RewardsPage() {
  const user = await requireUser();
  const env = readEnv();
  const [account, transactions] = await Promise.all([
    prisma.rewardAccount.findUnique({ where: { userId: user.id } }),
    listTransactions(user.id),
  ]);

  return (
    <>
      <h1 className="page-title">Rewards</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Your balance is kept in {rewardUnitName(env.rewardCurrencyCode)}. Credits come from verified BitLabs callbacks.
        TheoremReach is not connected. {rewardUnitExplanation(env.rewardCurrencyCode, env.rewardMinorUnitFactor)} A
        pending provider review can later reverse an approved credit. The balance never goes below zero.
      </p>
      <div className="mt-5">
        <RewardSummary
          availableUnits={account?.availableUnits ?? 0}
          lifetimeCreditedUnits={account?.lifetimeCreditedUnits ?? 0}
          currencyCode={env.rewardCurrencyCode}
          factor={env.rewardMinorUnitFactor}
        />
      </div>
      <h2 className="section-title mb-3 mt-8">Transactions</h2>
      <TransactionTable
        transactions={transactions}
        currencyCode={env.rewardCurrencyCode}
        factor={env.rewardMinorUnitFactor}
      />
    </>
  );
}
