import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/payouts/access";
import { reviewRiskAction } from "@/lib/risk/admin-actions";
import { RISK_REVIEW_TARGET_DAYS } from "@/lib/risk/config";

export const metadata: Metadata = { title: "Risk review" };
export const instant = false;

export default async function RiskReviewPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await io();
  const user = await requireUser();
  const env = readEnv();
  if (!isAdminEmail(user.email, env.adminEmails)) notFound();
  const params = await searchParams;
  const reviews = await prisma.riskReview.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const audits = await prisma.riskAudit.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <>
      <h1 className="page-title">Risk review</h1>
      {params.error ? <p className="mt-3 text-sm text-muted">That review action was not saved.</p> : null}
      {params.saved ? <p className="mt-3 text-sm text-muted">Review decision saved.</p> : null}
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        An open review pauses payout of the existing balance. It does not delete rewards. The response target is{" "}
        {RISK_REVIEW_TARGET_DAYS} days. Releasing a review does not pay the balance twice.
      </p>
      <ul className="mt-6 grid gap-4">
        {reviews.length === 0 ? <li className="text-sm text-muted">No reviews.</li> : null}
        {reviews.map((review) => (
          <li key={review.id} className="rounded-lg border border-line bg-white p-4 text-sm">
            <p className="font-medium text-ink">
              {review.status} · {review.level} · score {review.score}
            </p>
            <p className="mt-1 text-muted">Signals: {review.signals || "none"}</p>
            <p className="mt-1 text-muted">Account {review.userId}</p>
            <p className="mt-1 text-muted">Reference {review.correlationId}</p>
            {review.note ? <p className="mt-1 text-muted">Last note: {review.note}</p> : null}
            <form action={reviewRiskAction} className="mt-3 grid gap-2">
              <input type="hidden" name="reviewId" value={review.id} />
              <label className="grid gap-1">
                <span className="text-muted">Reason</span>
                <input name="note" required maxLength={200} className="rounded-md border border-line px-3 py-2" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button name="intent" value="release" className="btn btn-secondary">Release payout</button>
                <button name="intent" value="restrict" className="btn btn-secondary">Restrict surveys</button>
                <button name="intent" value="escalate" className="btn btn-secondary">Escalate</button>
              </div>
            </form>
          </li>
        ))}
      </ul>
      <h2 className="section-title mt-8">Audit</h2>
      <ul className="mt-3 grid gap-2 text-sm text-muted">
        {audits.map((audit) => (
          <li key={audit.id}>
            {audit.createdAt.toISOString()} · {audit.action} · {audit.note}
          </li>
        ))}
      </ul>
    </>
  );
}
