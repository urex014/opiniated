import { applyValidatedCallback, type AppliedCallback } from "@/lib/rewards/apply-callback";
import type { RewardStore } from "@/lib/rewards/types";
import { CPX_PROVIDER_ID } from "@/lib/survey-providers/registry";
import {
  authenticateCpxPostback,
  clip,
  parseCpxEvent,
  type CpxPostbackParams,
} from "@/lib/survey-providers/providers/cpx/validation";

export type CpxPostbackInput = {
  secureHash: string;
  params: CpxPostbackParams;
  currencyCode: string;
  minorUnitFactor: number;
};

export async function processCpxPostback(store: RewardStore, input: CpxPostbackInput): Promise<AppliedCallback> {
  const secret = input.secureHash.trim();
  if (!secret) return { httpStatus: 500, outcome: "INTERNAL_FAILURE" };

  const auth = authenticateCpxPostback(input.params, secret);
  if (!auth.ok) {
    await store.recordRejection({
      provider: CPX_PROVIDER_ID,
      outcome: auth.reason === "signature" ? "INVALID_SIGNATURE" : "INVALID_PAYLOAD",
      providerTxId: auth.transId,
      type: auth.status,
      userId: auth.userId,
    });
    return auth.reason === "signature"
      ? { httpStatus: 401, outcome: "INVALID_SIGNATURE" }
      : { httpStatus: 400, outcome: "INVALID_PAYLOAD" };
  }

  const event = parseCpxEvent(input.params, auth.transId, input.currencyCode, input.minorUnitFactor);
  if (!event) {
    await store.recordRejection({
      provider: CPX_PROVIDER_ID,
      outcome: "INVALID_PAYLOAD",
      providerTxId: auth.transId,
      type: clip(input.params.status),
      userId: clip(input.params.user_id),
    });
    return { httpStatus: 400, outcome: "INVALID_PAYLOAD" };
  }

  return applyValidatedCallback(store, event);
}
