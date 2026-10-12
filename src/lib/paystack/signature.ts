import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA512 hex of the raw body, compared with x-paystack-signature. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  if (!/^[0-9a-f]+$/i.test(signature) || signature.length % 2 !== 0) return false;
  const digest = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  const left = Buffer.from(digest, "hex");
  const right = Buffer.from(signature, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
