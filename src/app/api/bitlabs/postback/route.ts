import { callbackUrlForHash } from "@/lib/bitlabs/hash";
import { readEnv } from "@/lib/env";
import { createPrismaRewardStore } from "@/lib/rewards/prisma-store";
import { processPostback } from "@/lib/rewards/process-postback";
import { clientIpFromHeaders, isBitlabsCallbackIp } from "@/lib/security/ip";

export async function GET(request: Request) {
  const env = readEnv();
  if (!env.bitlabsSecret) {
    console.error("BitLabs postback rejected because BITLABS_SECRET is not set.");
    return new Response("not configured", { status: 500 });
  }

  if (env.enforceBitlabsIpAllowlist) {
    const ip = clientIpFromHeaders(request.headers);
    if (!isBitlabsCallbackIp(ip)) {
      console.error("BitLabs postback rejected for source IP.");
      return new Response("forbidden", { status: 403 });
    }
  }

  const url = new URL(request.url);
  const fullUrl = callbackUrlForHash(request.url, env.bitlabsCallbackUrl ?? undefined);
  const store = createPrismaRewardStore();

  try {
    const result = await processPostback(store, {
      fullUrl,
      secret: env.bitlabsSecret,
      currencyCode: env.rewardCurrencyCode,
      minorUnitFactor: env.rewardMinorUnitFactor,
      params: {
        uid: url.searchParams.get("uid") ?? undefined,
        tx: url.searchParams.get("tx") ?? undefined,
        val: url.searchParams.get("val") ?? undefined,
        raw: url.searchParams.get("raw") ?? undefined,
        type: url.searchParams.get("type") ?? undefined,
        ref: url.searchParams.get("ref") ?? undefined,
        survey_id: url.searchParams.get("survey_id") ?? undefined,
        reason: url.searchParams.get("reason") ?? undefined,
      },
    });
    console.info("BitLabs postback processed", { outcome: result.outcome, status: result.httpStatus });
    return new Response(result.httpStatus === 200 ? "ok" : "rejected", { status: result.httpStatus });
  } catch (error) {
    console.error("BitLabs postback failed before it could be acknowledged", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return new Response("error", { status: 500 });
  }
}
