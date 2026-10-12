import { BATCH_LIMIT } from "@/lib/payouts/constants";
import { evaluateEligibility, type EligibilityInput } from "@/lib/payouts/eligibility";
import type { PayoutRepository, WithdrawalSnapshot } from "@/lib/payouts/repository";

export type PayoutCandidate = {
  userId: string;
  email: string;
  deletedAt: Date | null;
  availableUnits: number;
  reservedUnits: number;
  accountUpdatedAt: Date | null;
  recipientCode: string | null;
  openWithdrawal: boolean;
  payoutHeld?: boolean;
};

export async function enrollEligible(input: {
  repo: PayoutRepository;
  candidates: PayoutCandidate[];
  currencyCode: string;
  nairaPerUsd: number;
  rateAt: Date;
  rateExpiresAt: Date;
  now: Date;
  minUsdCents: number;
  minimumKobo: number;
  limit?: number;
  referenceFor: (userId: string) => string;
}): Promise<WithdrawalSnapshot[]> {
  const enrolled: WithdrawalSnapshot[] = [];
  const limit = input.limit ?? BATCH_LIMIT;
  for (const candidate of input.candidates) {
    if (enrolled.length >= limit) break;
    const decision = evaluateEligibility(eligibilityFrom(candidate, input));
    if (!decision.ok) continue;
    const result = await input.repo.requestWithdrawal({
      userId: candidate.userId,
      points: decision.points,
      amountKobo: decision.amountKobo,
      minimumKobo: input.minimumKobo,
      reference: input.referenceFor(candidate.userId),
      status: "APPROVED",
      currencyCode: input.currencyCode,
      at: input.now,
      nairaPerUsd: decision.nairaPerUsd,
      rateAt: input.rateAt,
      usdCents: decision.usdCents,
    });
    if (result.ok) enrolled.push(result.withdrawal);
  }
  return enrolled;
}

function eligibilityFrom(
  candidate: PayoutCandidate,
  input: {
    currencyCode: string;
    nairaPerUsd: number;
    rateExpiresAt: Date;
    now: Date;
    minUsdCents: number;
    minimumKobo: number;
  },
): EligibilityInput {
  return {
    deletedAt: candidate.deletedAt,
    availableUnits: candidate.availableUnits,
    reservedUnits: candidate.reservedUnits,
    accountUpdatedAt: candidate.accountUpdatedAt,
    recipientCode: candidate.recipientCode,
    openWithdrawal: candidate.openWithdrawal,
    currencyCode: input.currencyCode,
    nairaPerUsd: input.nairaPerUsd,
    rateExpiresAt: input.rateExpiresAt,
    now: input.now,
    minUsdCents: input.minUsdCents,
    minimumKobo: input.minimumKobo,
    payoutHeld: candidate.payoutHeld === true,
  };
}
