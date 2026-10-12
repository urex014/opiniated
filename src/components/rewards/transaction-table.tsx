import { formatReward } from "@/lib/rewards/money";

export type TransactionRow = {
  id: string;
  createdAt: Date;
  type: string;
  status: string;
  appliedUnits: number;
  surveyId: string | null;
  shortfallUnits: number;
};

export function TransactionTable({
  transactions,
  currencyCode,
  factor,
}: {
  transactions: TransactionRow[];
  currencyCode: string;
  factor: number;
}) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-white px-4 py-6 text-sm leading-6 text-muted">
        No rewards yet. A reward appears here after BitLabs confirms a completion. Starting a survey does not add one.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">Reward history</caption>
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Details</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="border-b border-line last:border-b-0">
              <td className="px-4 py-3 text-muted">{formatWhen(transaction.createdAt)}</td>
              <td className="px-4 py-3">{detail(transaction)}</td>
              <td className={`px-4 py-3 ${statusClass(transaction.status)}`}>{statusLabel(transaction.status)}</td>
              <td className={`px-4 py-3 text-right ${amountClass(transaction.appliedUnits)}`}>{formatReward(transaction.appliedUnits, currencyCode, factor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="md:hidden">
        {transactions.map((transaction) => (
          <li key={transaction.id} className="border-b border-line px-4 py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{detail(transaction)}</p>
                <p className="text-xs text-muted">
                  {formatWhen(transaction.createdAt)} · {statusLabel(transaction.status)}
                </p>
              </div>
              <p className={amountClass(transaction.appliedUnits)}>{formatReward(transaction.appliedUnits, currencyCode, factor)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function detail(transaction: TransactionRow): string {
  const survey = transaction.surveyId ? `Survey ${transaction.surveyId}` : "Reward adjustment";
  if (transaction.type === "WITHDRAWAL") return "Bank withdrawal";
  if (transaction.type === "WITHDRAWAL_REVERSAL") return "Withdrawal returned";
  if (transaction.shortfallUnits > 0) return `${survey}. Part of this reversal could not be collected.`;
  if (transaction.type === "RECONCILIATION") {
    return transaction.appliedUnits < 0 ? `Reversal · ${survey}` : `Adjustment · ${survey}`;
  }
  if (transaction.type === "START_BONUS") return `Profile reward · ${survey}`;
  return survey;
}

function amountClass(units: number): string {
  if (units < 0) return "font-medium tabular-nums text-danger";
  return "font-medium tabular-nums text-brand";
}

function statusClass(status: string): string {
  if (status === "APPROVED") return "text-brand";
  if (status === "REVERSED" || status === "REJECTED") return "text-danger";
  return "text-muted";
}

function statusLabel(status: string): string {
  if (status === "APPROVED") return "Approved";
  if (status === "REVERSED") return "Reversed";
  if (status === "REJECTED") return "Rejected";
  if (status === "PENDING") return "Pending";
  return status;
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
