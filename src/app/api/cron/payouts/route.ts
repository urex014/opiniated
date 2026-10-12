import { connection } from "next/server";
import { readEnv } from "@/lib/env";
import { createPaystackClient } from "@/lib/paystack/client";
import { paystackKeyMode } from "@/lib/paystack/mode";
import { cronAuthorized } from "@/lib/payouts/cron-auth";
import { runAutoPayout } from "@/lib/payouts/cycle";
import { prismaAutoPayouts } from "@/lib/payouts/prisma-schedule";
import { prismaPayouts } from "@/lib/payouts/prisma-repository";
import { createWithdrawalReference } from "@/lib/payouts/reference";

export async function GET(request: Request) {
  await connection();
  const env = readEnv();
  if (!cronAuthorized(request.headers.get("authorization"), env.cronSecret)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const client = env.paystackSecretKey
    ? createPaystackClient({ secretKey: env.paystackSecretKey, baseUrl: env.paystackBaseUrl })
    : null;
  const result = await runAutoPayout({
    store: prismaAutoPayouts,
    repo: prismaPayouts,
    client,
    now: new Date(),
    currencyCode: env.rewardCurrencyCode,
    minimumKobo: env.payoutMinKobo,
    transfersEnabled: env.paystackTransfersEnabled,
    liveConfirmed: env.paystackLiveConfirmed,
    keyMode: paystackKeyMode(env.paystackSecretKey),
    feeBufferKobo: env.payoutFeeBufferKobo,
    referenceFor: () => createWithdrawalReference(1),
  });
  return Response.json({ ok: true, status: result.status, enrolled: result.enrolled, submitted: result.submitted });
}
