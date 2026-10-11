import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { formatReward } from "@/lib/rewards/money";
import { listActivity } from "@/lib/rewards/queries";

export const metadata: Metadata = { title: "Activity" };
export const instant = false;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const activity = await listActivity(user.id, Number.isFinite(page) ? page : 1);
  const env = readEnv();

  return (
    <>
      <h1 className="text-[28px] font-medium">Activity</h1>
      <p className="mt-1 text-sm text-muted">Survey attempts and reward changes for this account.</p>
      {activity.events.length === 0 ? (
        <p className="mt-5 border border-line bg-white px-4 py-6 text-sm text-muted">
          Nothing here yet. Start a survey and this page will show the attempt. Rewards appear after BitLabs confirms them.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-y border-line bg-white">
          {activity.events.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{event.label}</p>
                <p className="text-muted">{event.detail}</p>
                <p className="text-xs text-muted">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(event.at)}
                </p>
              </div>
              {event.amountUnits !== null ? (
                <p className="font-medium">{formatReward(event.amountUnits, env.rewardCurrencyCode, env.rewardMinorUnitFactor)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-4 text-sm">
        {activity.page > 1 ? (
          <Link href={`/activity?page=${activity.page - 1}`} className="text-brand">
            Previous
          </Link>
        ) : null}
        {activity.hasMore ? (
          <Link href={`/activity?page=${activity.page + 1}`} className="text-brand">
            Next
          </Link>
        ) : null}
      </div>
    </>
  );
}
