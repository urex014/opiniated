import { ReleaseBatchForm } from "@/components/payouts/admin-controls";
import type { BatchView, RecipientView } from "@/lib/payouts/review-list";

export function AdminPayoutBoard({ recipients, batches }: { recipients: RecipientView[]; batches: BatchView[] }) {
  return (
    <>
      <h2 className="section-title mb-3 mt-8">Recipients</h2>
      {recipients.length === 0 ? (
        <p className="text-sm text-muted">No verified bank accounts to review.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {recipients.map((row) => (
            <li key={row.userId} className="px-4 py-3 text-sm">
              <p className="font-medium">
                {row.email} · {row.points} · {row.amount}
              </p>
              <p className="mt-1 text-muted">{row.bank}</p>
              <p className="mt-1 text-muted">
                {row.eligibility} · {row.hold}
              </p>
              {row.flags.length > 0 ? <p className="mt-1 text-muted">{row.flags.join(" ")}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title mb-3 mt-8">Batches</h2>
      {batches.length === 0 ? (
        <p className="text-sm text-muted">No batches yet.</p>
      ) : (
        <div className="grid gap-4">
          {batches.map((batch) => (
            <article key={batch.id} className="rounded-lg border border-line bg-white px-4 py-3">
              <p className="font-medium">
                {batch.status} · created {batch.createdAt} · {batch.count} ready · {batch.totalLabel}
              </p>
              <p className="mt-1 text-sm text-muted">{batch.message}</p>
              <ul className="mt-3 divide-y divide-line">
                {batch.rows.map((row) => (
                  <li key={row.id} className="py-2 text-sm">
                    <p>
                      {row.email} · {row.amount}
                    </p>
                    <p className="text-muted">{row.bank}</p>
                    <p className="text-muted">{row.result}</p>
                    {row.flags.length > 0 ? <p className="text-muted">{row.flags.join(" ")}</p> : null}
                  </li>
                ))}
              </ul>
              {batch.releasable ? (
                <ReleaseBatchForm batchId={batch.id} count={batch.count} totalLabel={batch.totalLabel} totalKobo={batch.totalKobo} />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
