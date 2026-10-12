import { connection } from "next/server";
import { readEnv } from "@/lib/env";
import { cronAuthorized } from "@/lib/payouts/cron-auth";

/** Authenticated no-op. This route does not reserve balances or call Paystack. */
export async function GET(request: Request) {
  await connection();
  const env = readEnv();
  if (!cronAuthorized(request.headers.get("authorization"), env.cronSecret)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return Response.json({ ok: true, status: "disabled", enrolled: 0, submitted: 0 });
}
