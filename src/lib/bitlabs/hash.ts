import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * BitLabs signs the full callback URL, excluding the trailing `&hash=` value,
 * with the app secret using HEX-encoded HMAC-SHA1.
 * Documented at https://developer.bitlabs.ai/docs/securing-callbacks-through-hashing
 * Do not encode or decode the URL before hashing.
 */
export function verifyBitlabsHash(fullUrl: string, secret: string): boolean {
  if (!secret) return false;
  const marker = "&hash=";
  const splitAt = fullUrl.indexOf(marker);
  if (splitAt <= 0) return false;
  const unsignedUrl = fullUrl.slice(0, splitAt);
  const provided = fullUrl.slice(splitAt + marker.length).split("&")[0] ?? "";
  if (!/^[0-9a-fA-F]+$/.test(provided)) return false;
  const expected = createHmac("sha1", secret).update(unsignedUrl).digest("hex");
  const providedBuffer = Buffer.from(provided.toLowerCase());
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function callbackUrlForHash(requestUrl: string, configuredBase: string | undefined): string {
  const queryIndex = requestUrl.indexOf("?");
  const query = queryIndex === -1 ? "" : requestUrl.slice(queryIndex);
  if (!configuredBase) return requestUrl;
  return `${configuredBase.replace(/\/$/, "")}${query}`;
}
