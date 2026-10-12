import { createHash, timingSafeEqual } from "node:crypto";

/** MD5 hex of `ext_user_id + '-' + app secure hash`, as in the CPX API example. */
export function cpxApiSecureHash(extUserId: string, secureHash: string): string {
  return md5(`${extUserId}-${secureHash}`);
}

/**
 * CPX postback check: MD5 hex of `trans_id + '-' + app secure hash`,
 * compared with the `secure_hash` query parameter.
 */
export function verifyCpxPostbackHash(transId: string, provided: string, secureHash: string): boolean {
  const expected = Buffer.from(md5(`${transId}-${secureHash}`));
  const actual = Buffer.from(provided.trim().toLowerCase());
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}
