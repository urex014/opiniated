import { createHash } from "node:crypto";
import type { PaystackClient } from "@/lib/paystack/client";
import { verifyPaystackSignature } from "@/lib/paystack/signature";
import type { PayoutRepository } from "@/lib/payouts/repository";

type TransferEvent = "transfer.success" | "transfer.failed" | "transfer.reversed";

type ParsedEvent =
  | { kind: "ignored"; event: string; reference: string | null }
  | { kind: "transfer"; event: TransferEvent; reference: string };

export function paystackEventKey(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export async function handlePaystackWebhook(input: {
  rawBody: string;
  signature: string | null;
  secret: string | null;
  repo: PayoutRepository;
  client: PaystackClient;
  now: Date;
}): Promise<{ status: number }> {
  if (!input.secret || !verifyPaystackSignature(input.rawBody, input.signature, input.secret)) {
    return { status: 401 };
  }
  let body: unknown;
  try {
    body = JSON.parse(input.rawBody) as unknown;
  } catch {
    return { status: 400 };
  }
  const parsed = parseEvent(body);
  if (!parsed) return { status: 400 };

  const eventKey = paystackEventKey(input.rawBody);
  const existing = await input.repo.findEvent(eventKey);
  if (existing?.processedAt) return { status: 200 };
  if (!existing) {
    const created = await input.repo.createEvent({ eventKey, event: parsed.event, reference: parsed.reference });
    if (created === "exists") {
      const again = await input.repo.findEvent(eventKey);
      if (again?.processedAt) return { status: 200 };
    }
  }

  try {
    const note = await applyEvent(input, parsed);
    await input.repo.markEventProcessed(eventKey, note);
    return { status: 200 };
  } catch {
    return { status: 500 };
  }
}

async function applyEvent(
  input: { repo: PayoutRepository; client: PaystackClient; now: Date },
  parsed: ParsedEvent,
): Promise<string | null> {
  if (parsed.kind === "ignored") {
    return parsed.reference ? "Ignored event." : "Ignored event without a transfer reference.";
  }
  const withdrawal = await input.repo.getByReference(parsed.reference);
  if (!withdrawal) return "Unknown transfer reference.";

  const verified = await input.client.verifyTransfer(parsed.reference);
  if (verified.outcome === "unavailable") throw new Error("Paystack verification is unavailable.");
  if (verified.outcome === "not_found" || verified.status === "pending" || verified.status === "other") {
    throw new Error("Paystack verification is not final.");
  }

  const expected = expectedStatus(parsed.event);
  if (verified.status !== expected) {
    await input.repo.setAnomaly(withdrawal.id, `Webhook ${parsed.event} did not match provider status ${verified.status}.`);
    return "Provider status did not match the webhook.";
  }

  await input.repo.settle({
    reference: parsed.reference,
    verified: verified.status,
    amountKobo: verified.amount,
    currency: verified.currency,
    transferCode: verified.transferCode,
    at: input.now,
  });
  return null;
}

function expectedStatus(event: TransferEvent): "success" | "failed" | "reversed" {
  if (event === "transfer.success") return "success";
  if (event === "transfer.failed") return "failed";
  return "reversed";
}

function parseEvent(body: unknown): ParsedEvent | null {
  if (!body || typeof body !== "object" || !("event" in body) || typeof (body as { event: unknown }).event !== "string") {
    return null;
  }
  const event = (body as { event: string }).event;
  const data =
    "data" in body && (body as { data: unknown }).data && typeof (body as { data: unknown }).data === "object"
      ? ((body as { data: Record<string, unknown> }).data)
      : null;
  const reference = data && typeof data.reference === "string" && data.reference.length > 0 ? data.reference : null;
  if (event === "transfer.success" || event === "transfer.failed" || event === "transfer.reversed") {
    if (!reference) return { kind: "ignored", event, reference: null };
    return { kind: "transfer", event, reference };
  }
  return { kind: "ignored", event, reference };
}
