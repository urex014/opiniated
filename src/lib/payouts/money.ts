import { MAX_UNITS } from "@/lib/rewards/money";

export function pointsToKobo(points: number, koboPerPoint: number): number | null {
  if (!Number.isInteger(points) || points < 1 || points > MAX_UNITS) return null;
  if (!Number.isInteger(koboPerPoint) || koboPerPoint < 1) return null;
  const product = BigInt(points) * BigInt(koboPerPoint);
  if (product > BigInt(MAX_UNITS)) return null;
  return Number(product);
}

export function minimumPoints(minKobo: number, koboPerPoint: number): number | null {
  if (!Number.isInteger(minKobo) || minKobo < 1) return null;
  if (!Number.isInteger(koboPerPoint) || koboPerPoint < 1) return null;
  return Number((BigInt(minKobo) + BigInt(koboPerPoint) - BigInt(1)) / BigInt(koboPerPoint));
}

export function fundingCovers(balanceKobo: number, amountsKobo: number[], feeBufferKobo: number): boolean {
  if (!Number.isInteger(balanceKobo) || balanceKobo < 0) return false;
  if (!Number.isInteger(feeBufferKobo) || feeBufferKobo < 0) return false;
  let total = BigInt(0);
  for (const amount of amountsKobo) {
    if (!Number.isInteger(amount) || amount < 1) return false;
    total += BigInt(amount);
  }
  const fees = BigInt(feeBufferKobo) * BigInt(amountsKobo.length);
  return BigInt(balanceKobo) >= total + fees;
}

/**
 * Nigeria transfer fee estimate in kobo, plus ₦50 stamp duty at ₦10,000 and above.
 * The buffer in fundingCoversWithFees is extra headroom, not a second copy of this fee.
 * This is not a quote from Paystack.
 */
export function estimatedPaystackFeeKobo(amountKobo: number): number | null {
  if (!Number.isInteger(amountKobo) || amountKobo < 1) return null;
  let fee = 5_000;
  if (amountKobo <= 500_000) fee = 1_000;
  else if (amountKobo <= 5_000_000) fee = 2_500;
  if (amountKobo >= 1_000_000) fee += 5_000;
  return fee;
}

export function fundingCoversWithFees(balanceKobo: number, amountsKobo: number[], extraBufferKobo: number): boolean {
  if (!Number.isInteger(balanceKobo) || balanceKobo < 0) return false;
  if (!Number.isInteger(extraBufferKobo) || extraBufferKobo < 0) return false;
  let total = BigInt(0);
  for (const amount of amountsKobo) {
    const fee = estimatedPaystackFeeKobo(amount);
    if (fee == null) return false;
    total += BigInt(amount) + BigInt(fee) + BigInt(extraBufferKobo);
  }
  return BigInt(balanceKobo) >= total;
}
