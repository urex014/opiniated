import { randomBytes } from "node:crypto";

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // base32 without ambiguous 0/O, 1/I

export function generateReferralCode(): string {
  const bytes = randomBytes(6);
  let code = "OPN";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

export function isValidReferralCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  return /^[A-Za-z0-9_-]{3,32}$/.test(trimmed);
}

export function normalizeReferralCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  return isValidReferralCode(trimmed) ? trimmed : null;
}

export function referralLink(code: string, origin = "https://opiniated.vercel.app/register"): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/?ref=${encodeURIComponent(code)}`;
}
