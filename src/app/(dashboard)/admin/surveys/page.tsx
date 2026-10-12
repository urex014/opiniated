import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/payouts/access";
import { CPX_PROVIDER_ID, listSurveyProviders } from "@/lib/survey-providers/registry";

export const metadata: Metadata = { title: "Survey providers" };
export const instant = false;

export default async function AdminSurveysPage() {
  await io();
  const user = await requireUser();
  const env = readEnv();
  if (!isAdminEmail(user.email, env.adminEmails)) notFound();

  const providers = listSurveyProviders(env);
  const [completions, reversals, logs] = await Promise.all([
    prisma.rewardTransaction.count({ where: { provider: CPX_PROVIDER_ID, type: "COMPLETE" } }),
    prisma.rewardTransaction.count({ where: { provider: CPX_PROVIDER_ID, type: "RECONCILIATION" } }),
    prisma.postbackLog.findMany({
      where: { provider: CPX_PROVIDER_ID },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { outcome: true, type: true, createdAt: true },
    }),
  ]);
  const outcomes = new Map<string, number>();
  for (const log of logs) outcomes.set(log.outcome, (outcomes.get(log.outcome) ?? 0) + 1);

  return (
    <>
      <h1 className="page-title">Survey providers</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        A provider is offered to members only when it is configured and enabled. Credentials stay in the host
        environment. This page does not show them and cannot turn a provider on by itself.
      </p>
      <ul className="mt-6 grid gap-4">
        {providers.map((provider) => (
          <li key={provider.id} className="rounded-lg border border-line bg-white p-4 text-sm">
            <p className="font-medium text-ink">{provider.displayName}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Configured</dt>
                <dd>{provider.configured ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Enabled</dt>
                <dd>{provider.enabled ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Survey list</dt>
                <dd>{provider.capabilities.surveyList ? "Supported" : "Not used"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Signed postback</dt>
                <dd>{provider.capabilities.signedPostback ? "Supported" : "Not used"}</dd>
              </div>
            </dl>
            {provider.configError ? <p className="mt-3 text-muted">{provider.configError}</p> : null}
            {provider.id === CPX_PROVIDER_ID ? (
              <p className="mt-3 text-muted">
                Completions {completions}. Reversals {reversals}. Latest callbacks: {formatOutcomes(outcomes)}.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 className="section-title mt-8">Recent callback outcomes</h2>
      {logs.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No callbacks recorded.</p>
      ) : (
        <ul className="mt-3 grid gap-2 text-sm text-muted">
          {logs.map((log, index) => (
            <li key={`${log.createdAt.toISOString()}-${log.outcome}-${index}`}>
              {log.createdAt.toISOString()} · {log.outcome}
              {log.type ? ` · ${log.type}` : ""}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function formatOutcomes(outcomes: Map<string, number>): string {
  if (outcomes.size === 0) return "none";
  return [...outcomes.entries()].map(([outcome, count]) => `${outcome} ${count}`).join(", ");
}
