import { createHmac, randomBytes } from "node:crypto";

export function newCorrelationId(): string {
  return randomBytes(8).toString("hex");
}

export function fingerprint(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;
  const domain = trimmed.slice(at + 1);
  let local = trimmed.slice(0, at).split("+")[0] ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}

export function bankFingerprint(input: { bankCode: string; accountLast4: string; accountName: string }): string {
  const name = input.accountName.trim().toLowerCase().replace(/\s+/g, " ");
  return `${input.bankCode}:${input.accountLast4}:${name}`;
}
