export const MAX_UNITS = 1_000_000_000;

export function isPowerOfTen(factor: number): boolean {
  if (!Number.isInteger(factor) || factor < 1) return false;
  let value = factor;
  while (value % 10 === 0) value /= 10;
  return value === 1;
}

export function decimalPlaces(factor: number): number {
  return String(factor).length - 1;
}

/**
 * Convert a BitLabs decimal string into integer minor units.
 * `1.20` with factor 100 becomes 120. `120` with factor 1 stays 120.
 * Returns null when the value is not a plain decimal or overflows.
 */
export function parseRewardUnits(raw: string, factor: number): number | null {
  if (!isPowerOfTen(factor)) return null;
  const match = raw.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? "";
  const places = decimalPlaces(factor);
  const kept = (fraction + "0".repeat(places)).slice(0, places);
  const remainder = fraction.slice(places);
  let minor = BigInt(whole) * BigInt(factor) + BigInt(kept === "" ? "0" : kept);
  if (remainder[0] !== undefined && remainder[0] >= "5") minor += BigInt(1);
  minor *= BigInt(sign);
  if (minor > BigInt(MAX_UNITS) || minor < BigInt(-MAX_UNITS)) return null;
  return Number(minor);
}

const ISO_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "JPY",
  "INR",
  "NGN",
  "ZAR",
  "KES",
  "GHS",
]);

/** 100 OPN = $1.00. One OPN is one US cent. */
export const OPN_PER_USD = 100;

export function formatOpnAmount(units: number): string {
  if (!Number.isInteger(units)) return `${units} OPN`;
  const negative = units < 0;
  const abs = Math.abs(units);
  const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(abs);
  const cents = BigInt(abs);
  const dollars = cents / BigInt(OPN_PER_USD);
  const remainder = cents % BigInt(OPN_PER_USD);
  const usd = `$${dollars.toString()}.${remainder.toString().padStart(2, "0")}`;
  const sign = negative ? "-" : "";
  return `${sign}${grouped} OPN (${sign}${usd})`;
}

export function formatReward(units: number, currencyCode: string, factor: number): string {
  if (currencyCode === "OPN") return formatOpnAmount(units);
  const places = isPowerOfTen(factor) ? decimalPlaces(factor) : 0;
  const major = units / factor;
  if (ISO_CURRENCIES.has(currencyCode)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    }).format(major);
  }
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: places,
  }).format(major);
  return `${formatted} ${currencyCode}`;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} ${rounded === 1 ? "minute" : "minutes"}`;
}
