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
  BITLABS_API_TOKEN: z.string().min(1).optional(),
  BITLABS_SECRET: z.string().min(1).optional(),
  BITLABS_CALLBACK_URL: z.string().url().optional(),
  BITLABS_ENFORCE_IP_ALLOWLIST: z.enum(["true", "false"]).optional(),
  REWARD_CURRENCY_CODE: z.string().min(1).optional(),
  REWARD_MINOR_UNIT_FACTOR: z.coerce.number().int().positive().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  TURNSTILE_HOSTNAMES: z.string().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
});

export type AppEnv = {
  databaseUrl: string;
  authSecret: string;
  appUrl: string;
  bitlabsApiToken: string | null;
  bitlabsSecret: string | null;
  bitlabsCallbackUrl: string | null;
  enforceBitlabsIpAllowlist: boolean;
  rewardCurrencyCode: string;
  rewardMinorUnitFactor: number;
  supportEmail: string | null;
  turnstileSiteKey: string | null;
  turnstileSecret: string | null;
  turnstileHostnames: string[];
  email: { apiKey: string; from: string } | null;
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
    BITLABS_API_TOKEN: blankToUndefined(source.BITLABS_API_TOKEN),
    BITLABS_SECRET: blankToUndefined(source.BITLABS_SECRET),
    BITLABS_CALLBACK_URL: blankToUndefined(source.BITLABS_CALLBACK_URL),
    BITLABS_ENFORCE_IP_ALLOWLIST: blankToUndefined(source.BITLABS_ENFORCE_IP_ALLOWLIST),
    REWARD_CURRENCY_CODE: blankToUndefined(source.REWARD_CURRENCY_CODE),
    REWARD_MINOR_UNIT_FACTOR: blankToUndefined(source.REWARD_MINOR_UNIT_FACTOR),
    NEXT_PUBLIC_SUPPORT_EMAIL: blankToUndefined(source.NEXT_PUBLIC_SUPPORT_EMAIL),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: blankToUndefined(source.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    TURNSTILE_SECRET_KEY: blankToUndefined(source.TURNSTILE_SECRET_KEY),
    TURNSTILE_HOSTNAMES: blankToUndefined(source.TURNSTILE_HOSTNAMES),
    RESEND_API_KEY: blankToUndefined(source.RESEND_API_KEY),
    EMAIL_FROM: blankToUndefined(source.EMAIL_FROM),
  });

  const factor = parsed.REWARD_MINOR_UNIT_FACTOR ?? 1;
  if (!isPowerOfTen(factor)) {
    throw new Error("REWARD_MINOR_UNIT_FACTOR must be a power of ten, such as 1 or 100.");
  }

  return {
    databaseUrl: parsed.DATABASE_URL ?? "",
    authSecret: parsed.AUTH_SECRET ?? "",
    appUrl: parsed.APP_URL ?? "http://localhost:3000",
    bitlabsApiToken: parsed.BITLABS_API_TOKEN ?? null,
    bitlabsSecret: parsed.BITLABS_SECRET ?? null,
    bitlabsCallbackUrl: parsed.BITLABS_CALLBACK_URL ?? null,
    enforceBitlabsIpAllowlist: parsed.BITLABS_ENFORCE_IP_ALLOWLIST === "true",
    rewardCurrencyCode: parsed.REWARD_CURRENCY_CODE ?? "PTS",
    rewardMinorUnitFactor: factor,
    supportEmail: parsed.NEXT_PUBLIC_SUPPORT_EMAIL ?? null,
    turnstileSiteKey: parsed.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    turnstileSecret: parsed.TURNSTILE_SECRET_KEY ?? null,
    turnstileHostnames: (parsed.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
    email: emailConfig(parsed.RESEND_API_KEY, parsed.EMAIL_FROM),
  };
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
