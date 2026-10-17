import { createHmac, timingSafeEqual } from "node:crypto";
import { readEnv } from "@/lib/env";

const TOKEN_EXPIRY_SECONDS = 86400; // 24 hours

export function generateTelegramVerificationPayload(userId: string): string {
  const env = readEnv();
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
  const signature = createHmac("sha256", env.authSecret)
    .update(`${userId}:${expiresAt}`)
    .digest("hex")
    .slice(0, 16);
  return `${userId}_${expiresAt}_${signature}`;
}

export function verifyTelegramVerificationPayload(
  payload: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): { ok: true; userId: string } | { ok: false; reason: string } {
  const parts = payload.trim().split("_");
  if (parts.length !== 3) {
    return { ok: false, reason: "invalid_format" };
  }

  const [userId, rawExpiresAt, signature] = parts;
  if (!userId || !rawExpiresAt || !signature) {
    return { ok: false, reason: "invalid_format" };
  }

  const expiresAt = Number.parseInt(rawExpiresAt, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < nowSeconds) {
    return { ok: false, reason: "expired" };
  }

  const env = readEnv();
  const expectedSig = createHmac("sha256", env.authSecret)
    .update(`${userId}:${expiresAt}`)
    .digest("hex")
    .slice(0, 16);

  if (
    signature.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  ) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, userId };
}
