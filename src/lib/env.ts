import { z } from "zod";
import { isPowerOfTen } from "@/lib/rewards/money";

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"), {
      message: "DATABASE_URL must be a MongoDB connection string.",
    })
    .optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  APP_URL: z.string().url().optional(),
  CPX_RESEARCH_APP_ID: z
    .string()
    .regex(/^\d{1,12}$/)
    .optional(),
  CPX_RESEARCH_SECURE_HASH: z.string().min(1).optional(),
  CPX_RESEARCH_ENABLED: z.enum(["true", "false"]).optional(),
  CPX_RESEARCH_API_BASE: z.string().url().optional(),
  REWARD_CURRENCY_CODE: z.string().min(1).optional(),
  REWARD_MINOR_UNIT_FACTOR: z.coerce.number().int().positive().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  TURNSTILE_HOSTNAMES: z.string().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  PAYSTACK_PUBLIC_KEY: z.string().min(1).optional(),
  PAYSTACK_BASE_URL: z.string().url().optional(),
  PAYSTACK_TRANSFERS_ENABLED: z.enum(["true", "false"]).optional(),
  PAYSTACK_LIVE_CONFIRMED: z.enum(["true", "false"]).optional(),
  PAYOUT_MIN_KOBO: z.coerce.number().int().positive().optional(),
  PAYOUT_FEE_BUFFER_KOBO: z.coerce.number().int().nonnegative().optional(),
  ADMIN_EMAILS: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  TRUST_PROXY_HEADERS: z.enum(["true", "false"]).optional(),
  RISK_FINGERPRINT_KEY: z.string().min(32).optional(),
  IP_REPUTATION_URL: z.string().url().optional(),
  IP_REPUTATION_TIMEOUT_MS: z.coerce.number().int().positive().max(5_000).optional(),
  RISK_EVENT_RETENTION_DAYS: z.coerce.number().int().positive().max(365).optional(),
});

export type AppEnv = {
  databaseUrl: string;
  authSecret: string;
  appUrl: string;
  cpxAppId: string | null;
  cpxSecureHash: string | null;
  cpxEnabled: boolean;
  cpxApiBase: string;
  rewardCurrencyCode: string;
  rewardMinorUnitFactor: number;
  supportEmail: string | null;
  turnstileSiteKey: string | null;
  turnstileSecret: string | null;
  turnstileHostnames: string[];
  email: { apiKey: string; from: string } | null;
  paystackSecretKey: string | null;
  paystackPublicKey: string | null;
  paystackBaseUrl: string;
  paystackTransfersEnabled: boolean;
  paystackLiveConfirmed: boolean;
  payoutKoboPerPoint: number | null;
  payoutMinKobo: number;
  payoutFeeBufferKobo: number;
  adminEmails: string[];
  cronSecret: string | null;
  trustProxyHeaders: boolean;
  riskFingerprintKey: string | null;
  ipReputationUrl: string | null;
  ipReputationTimeoutMs: number;
  riskEventRetentionDays: number;
};

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = schema.parse({
    DATABASE_URL: blankToUndefined(source.DATABASE_URL),
    AUTH_SECRET: blankToUndefined(source.AUTH_SECRET),
    APP_URL: blankToUndefined(source.APP_URL),
    CPX_RESEARCH_APP_ID: blankToUndefined(source.CPX_RESEARCH_APP_ID),
    CPX_RESEARCH_SECURE_HASH: blankToUndefined(source.CPX_RESEARCH_SECURE_HASH),
    CPX_RESEARCH_ENABLED: blankToUndefined(source.CPX_RESEARCH_ENABLED),
    CPX_RESEARCH_API_BASE: blankToUndefined(source.CPX_RESEARCH_API_BASE),
    REWARD_CURRENCY_CODE: blankToUndefined(source.REWARD_CURRENCY_CODE),
    REWARD_MINOR_UNIT_FACTOR: blankToUndefined(source.REWARD_MINOR_UNIT_FACTOR),
    NEXT_PUBLIC_SUPPORT_EMAIL: blankToUndefined(source.NEXT_PUBLIC_SUPPORT_EMAIL),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: blankToUndefined(source.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    TURNSTILE_SECRET_KEY: blankToUndefined(source.TURNSTILE_SECRET_KEY),
    TURNSTILE_HOSTNAMES: blankToUndefined(source.TURNSTILE_HOSTNAMES),
    RESEND_API_KEY: blankToUndefined(source.RESEND_API_KEY),
    EMAIL_FROM: blankToUndefined(source.EMAIL_FROM),
    PAYSTACK_SECRET_KEY: blankToUndefined(source.PAYSTACK_SECRET_KEY),
    PAYSTACK_PUBLIC_KEY: blankToUndefined(source.PAYSTACK_PUBLIC_KEY),
    PAYSTACK_BASE_URL: blankToUndefined(source.PAYSTACK_BASE_URL),
    PAYSTACK_TRANSFERS_ENABLED: blankToUndefined(source.PAYSTACK_TRANSFERS_ENABLED),
    PAYSTACK_LIVE_CONFIRMED: blankToUndefined(source.PAYSTACK_LIVE_CONFIRMED),
    PAYOUT_MIN_KOBO: blankToUndefined(source.PAYOUT_MIN_KOBO),
    PAYOUT_FEE_BUFFER_KOBO: blankToUndefined(source.PAYOUT_FEE_BUFFER_KOBO),
    ADMIN_EMAILS: blankToUndefined(source.ADMIN_EMAILS),
    CRON_SECRET: blankToUndefined(source.CRON_SECRET),
    TRUST_PROXY_HEADERS: blankToUndefined(source.TRUST_PROXY_HEADERS),
    RISK_FINGERPRINT_KEY: blankToUndefined(source.RISK_FINGERPRINT_KEY),
    IP_REPUTATION_URL: blankToUndefined(source.IP_REPUTATION_URL),
    IP_REPUTATION_TIMEOUT_MS: blankToUndefined(source.IP_REPUTATION_TIMEOUT_MS),
    RISK_EVENT_RETENTION_DAYS: blankToUndefined(source.RISK_EVENT_RETENTION_DAYS),
  });

  const factor = parsed.REWARD_MINOR_UNIT_FACTOR ?? 1;
  if (!isPowerOfTen(factor)) {
    throw new Error("REWARD_MINOR_UNIT_FACTOR must be a power of ten, such as 1 or 100.");
  }

  const currencyCode = parsed.REWARD_CURRENCY_CODE ?? "PTS";
  const configuredRate = wholeKobo(blankToUndefined(source.PAYOUT_KOBO_PER_POINT));
  const nairaPerUsd = wholeKobo(blankToUndefined(source.PAYOUT_NGN_PER_USD));
  if (currencyCode === "NGN" && factor === 100 && configuredRate != null && configuredRate !== 1) {
    throw new Error("PAYOUT_KOBO_PER_POINT must be 1 when rewards are already stored as kobo.");
  }
  if (currencyCode === "OPN" && configuredRate != null && nairaPerUsd != null && configuredRate !== nairaPerUsd) {
    throw new Error("For OPN, PAYOUT_KOBO_PER_POINT must equal PAYOUT_NGN_PER_USD. 100 OPN equal $1, so one OPN is worth that many kobo.");
  }
  const paystackBaseUrl = parsed.PAYSTACK_BASE_URL ?? "https://api.paystack.co";
  if (!paystackBaseUrl.startsWith("https://")) {
    throw new Error("PAYSTACK_BASE_URL must use HTTPS.");
  }
  const cpxApiBase = parsed.CPX_RESEARCH_API_BASE ?? "https://live-api.cpx-research.com";
  if (!cpxApiBase.startsWith("https://")) {
    throw new Error("CPX_RESEARCH_API_BASE must use HTTPS.");
  }

  return {
    databaseUrl: parsed.DATABASE_URL ?? "",
    authSecret: parsed.AUTH_SECRET ?? "",
    appUrl: parsed.APP_URL ?? "http://localhost:3000",
    cpxAppId: parsed.CPX_RESEARCH_APP_ID ?? null,
    cpxSecureHash: parsed.CPX_RESEARCH_SECURE_HASH ?? null,
    cpxEnabled: parsed.CPX_RESEARCH_ENABLED === "true",
    cpxApiBase,
    rewardCurrencyCode: currencyCode,
    rewardMinorUnitFactor: factor,
    supportEmail: parsed.NEXT_PUBLIC_SUPPORT_EMAIL ?? null,
    turnstileSiteKey: parsed.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    turnstileSecret: parsed.TURNSTILE_SECRET_KEY ?? null,
    turnstileHostnames: (parsed.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
    email: emailConfig(parsed.RESEND_API_KEY, parsed.EMAIL_FROM),
    paystackSecretKey: parsed.PAYSTACK_SECRET_KEY ?? null,
    paystackPublicKey: parsed.PAYSTACK_PUBLIC_KEY ?? null,
    paystackBaseUrl,
    paystackTransfersEnabled: parsed.PAYSTACK_TRANSFERS_ENABLED === "true",
    paystackLiveConfirmed: parsed.PAYSTACK_LIVE_CONFIRMED === "true",
    payoutKoboPerPoint: koboPerRewardUnit(currencyCode, factor, configuredRate, nairaPerUsd),
    payoutMinKobo: parsed.PAYOUT_MIN_KOBO ?? 10_000,
    payoutFeeBufferKobo: parsed.PAYOUT_FEE_BUFFER_KOBO ?? 0,
    adminEmails: (parsed.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => z.string().email().safeParse(email).success),
    cronSecret: parsed.CRON_SECRET ?? null,
    trustProxyHeaders: parsed.TRUST_PROXY_HEADERS === "true" || (parsed.TRUST_PROXY_HEADERS !== "false" && process.env.VERCEL === "1"),
    riskFingerprintKey: parsed.RISK_FINGERPRINT_KEY ?? null,
    ipReputationUrl: parsed.IP_REPUTATION_URL ?? null,
    ipReputationTimeoutMs: parsed.IP_REPUTATION_TIMEOUT_MS ?? 800,
    riskEventRetentionDays: parsed.RISK_EVENT_RETENTION_DAYS ?? 30,
  };
}

function wholeKobo(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function koboPerRewardUnit(
  currencyCode: string,
  factor: number,
  configuredRate: number | null,
  nairaPerUsd: number | null,
): number | null {
  if (currencyCode === "NGN" && factor === 100) return 1;
  if (currencyCode === "OPN") return nairaPerUsd ?? configuredRate;
  return configuredRate;
}

function emailConfig(apiKey: string | undefined, from: string | undefined): AppEnv["email"] {
  const sender = normalizeFrom(from);
  if (!apiKey || !sender) return null;
  return { apiKey, from: sender };
}

function normalizeFrom(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^(.+?)\s*<([^<>\s]+)>$/);
  const address = (wrapped ? wrapped[2] : trimmed).trim();
  const name = wrapped ? wrapped[1].trim().replace(/^["']|["']$/g, "") : "";
  if (name.includes("<") || name.includes(">")) return null;
  if (!z.string().email().safeParse(address).success) return null;
  return name ? `${name} <${address}>` : address;
}

export function requireDatabaseUrl(): string {
  const url = readEnv().databaseUrl;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}

export function requireAuthSecret(): string {
  const secret = readEnv().authSecret;
  if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return secret;
}
