import type { Metadata } from "next";
import { RewardSummary } from "@/components/rewards/reward-summary";
import { TransactionTable } from "@/components/rewards/transaction-table";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
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
      <h1 className="text-[28px] font-medium">Rewards</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        This page tracks rewards credited by verified BitLabs callbacks. It does not pay money out. Redemption is not available in this version.
      </p>
      <div className="mt-5">
        <RewardSummary
          availableUnits={account?.availableUnits ?? 0}
          lifetimeCreditedUnits={account?.lifetimeCreditedUnits ?? 0}
          currencyCode={env.rewardCurrencyCode}
          factor={env.rewardMinorUnitFactor}
        />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-medium">Transactions</h2>
      <TransactionTable
        transactions={transactions}
        currencyCode={env.rewardCurrencyCode}
        factor={env.rewardMinorUnitFactor}
      />
    </>
  );
}
