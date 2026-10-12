import { readEnv } from "@/lib/env";
import { createPaystackClient } from "@/lib/paystack/client";
import { prismaPayouts } from "@/lib/payouts/prisma-repository";
import { handlePaystackWebhook } from "@/lib/payouts/webhook-handler";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const env = readEnv();
  if (!env.paystackSecretKey) return new Response(null, { status: 401 });
  const result = await handlePaystackWebhook({
    rawBody,
    signature: request.headers.get("x-paystack-signature"),
    secret: env.paystackSecretKey,
    repo: prismaPayouts,
    client: createPaystackClient({ secretKey: env.paystackSecretKey, baseUrl: env.paystackBaseUrl }),
    now: new Date(),
  });
  return new Response(null, { status: result.status });
}

export function GET() {
  return new Response(null, { status: 405 });
}
