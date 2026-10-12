import { parseRewardUnits } from "@/lib/rewards/money";
import type { ValidatedCallback } from "@/lib/rewards/types";
import { CPX_PROVIDER_ID } from "@/lib/survey-providers/registry";
import { verifyCpxPostbackHash } from "@/lib/survey-providers/providers/cpx/hash";

export type CpxPostbackParams = {
  status?: string;
  trans_id?: string;
  user_id?: string;
  amount_local?: string;
  amount_usd?: string;
  offer_id?: string;
  secure_hash?: string;
  /** Present on CPX callbacks. Never used to accept or reject the callback. */
  ip_click?: string;
};

export type CpxAuthResult =
  | { ok: true; transId: string }
  | { ok: false; reason: "payload" | "signature"; transId?: string; userId?: string; status?: string };

/**
 * Status 2 is treated as one reversal of `amount_local`.
 * CPX's postback manual is not published at the documented URL, and the tester
 * sends status 1 and 2. A reversal reuses `trans_id` in that tester, so the
 * ledger key is `${trans_id}:reversal` and the original id is `refTxId`.
 * Confirm that pairing in the publisher dashboard before enabling live traffic.
 */
export function authenticateCpxPostback(params: CpxPostbackParams, secureHash: string): CpxAuthResult {
  const transId = clean(params.trans_id);
  const userId = clip(params.user_id);
  const status = clip(params.status);
  if (!transId) return { ok: false, reason: "payload", userId, status };
  const provided = clean(params.secure_hash);
  if (!provided || !verifyCpxPostbackHash(transId, provided, secureHash)) {
    return { ok: false, reason: "signature", transId: transId.slice(0, 255), userId, status };
  }
  if (transId.length > 255) return { ok: false, reason: "payload", transId: transId.slice(0, 255), userId, status };
  return { ok: true, transId };
}

export function parseCpxEvent(
  params: CpxPostbackParams,
  transId: string,
  currencyCode: string,
  minorUnitFactor: number,
): ValidatedCallback | null {
  const userId = clean(params.user_id);
  const status = clean(params.status);
  if (!userId || !status || userId.length > 255 || status.length > 32) return null;
  const providerUsd = plainDecimal(params.amount_usd);
  const surveyId = surveyRef(params.offer_id);
  if (status === "1") {
    const amount = parseRewardUnits(params.amount_local ?? "", minorUnitFactor);
    if (amount === null || amount <= 0) return null;
    return event(userId, transId, "COMPLETE", amount, currencyCode, surveyId, null, null, providerUsd, "reward");
  }
  if (status === "2") {
    const amount = parseRewardUnits(params.amount_local ?? "", minorUnitFactor);
    if (amount === null || amount === 0) return null;
    return event(
      userId,
      `${transId}:reversal`,
      "RECONCILIATION",
      -Math.abs(amount),
      currencyCode,
      surveyId,
      transId,
      "cpx_status_2",
      providerUsd,
      "reward",
    );
  }
  return event(userId, transId, "SCREENOUT", 0, currencyCode, surveyId, null, `cpx_status_${status}`, providerUsd, "unsupported");
}

function event(
  userId: string,
  providerTxId: string,
  type: ValidatedCallback["type"],
  amountUnits: number,
  currencyCode: string,
  surveyId: string | null,
  refTxId: string | null,
  reason: string | null,
  providerUsd: string | null,
  disposition: ValidatedCallback["disposition"],
): ValidatedCallback {
  return {
    provider: CPX_PROVIDER_ID,
    userId,
    providerTxId,
    type,
    amountUnits,
    currencyCode,
    surveyId,
    refTxId,
    reason,
    providerUsd,
    disposition,
  };
}

function plainDecimal(value: string | undefined): string | null {
  const trimmed = clean(value);
  if (!trimmed || trimmed.length > 32 || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return trimmed;
}

function surveyRef(value: string | undefined): string | null {
  const trimmed = clean(value);
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

export function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function clip(value: string | undefined): string | undefined {
  return clean(value)?.slice(0, 255) ?? undefined;
}
