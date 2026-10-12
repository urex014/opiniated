import { randomBytes } from "node:crypto";

const REFERENCE = /^[a-z0-9_-]{16,50}$/;

/** Paystack references are 16–50 characters: a-z, digits, hyphen, underscore. */
export function createWithdrawalReference(attempt: number): string {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 99) {
    throw new Error("Invalid withdrawal attempt.");
  }
  const reference = `wd_${randomBytes(12).toString("hex")}_${attempt}`;
  if (!isTransferReference(reference)) throw new Error("Invalid withdrawal reference.");
  return reference;
}

export function isTransferReference(value: string): boolean {
  return REFERENCE.test(value);
}
