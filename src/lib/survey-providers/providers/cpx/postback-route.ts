import { readEnv } from "@/lib/env";
import { createPrismaRewardStore } from "@/lib/rewards/prisma-store";
import { noteCreditedCompletion } from "@/lib/risk/postback-signal";
import { cpxProvider } from "@/lib/survey-providers/providers/cpx/adapter";

export async function handleCpxPostback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const env = readEnv();
  if (!env.cpxSecureHash) {
    console.error("CPX postback rejected because CPX_RESEARCH_SECURE_HASH is not set.");
    return new Response("not configured", { status: 500 });
  }

  const store = createPrismaRewardStore();
  try {
    const result = await cpxProvider.processPostback(store, {
      secureHash: env.cpxSecureHash,
      currencyCode: env.rewardCurrencyCode,
      minorUnitFactor: env.rewardMinorUnitFactor,
      params: {
        status: url.searchParams.get("status") ?? undefined,
        trans_id: url.searchParams.get("trans_id") ?? undefined,
        user_id: url.searchParams.get("user_id") ?? undefined,
        amount_local: url.searchParams.get("amount_local") ?? undefined,
        amount_usd: url.searchParams.get("amount_usd") ?? undefined,
        offer_id: url.searchParams.get("offer_id") ?? url.searchParams.get("offer_ID") ?? undefined,
        secure_hash: url.searchParams.get("secure_hash") ?? undefined,
        ip_click: url.searchParams.get("ip_click") ?? undefined,
      },
    });
    if (result.outcome === "ACCEPTED" && url.searchParams.get("status") === "1") {
      await noteCreditedCompletion(url.searchParams.get("user_id") ?? "", "COMPLETE").catch((error: unknown) => {
        console.error("completion velocity check failed", { message: error instanceof Error ? error.message : "unknown" });
      });
    }
    console.info("CPX postback processed", { outcome: result.outcome, status: result.httpStatus });
    return new Response(result.httpStatus === 200 ? "ok" : "rejected", { status: result.httpStatus });
  } catch (error) {
    console.error("CPX postback failed before it could be acknowledged", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return new Response("error", { status: 500 });
  }
}
