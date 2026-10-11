import { verifyBitlabsHash } from "@/lib/bitlabs/hash";
import { parseRewardUnits } from "@/lib/rewards/money";
import type { CallbackType, PostbackOutcome, RewardStore, ValidatedCallback } from "@/lib/rewards/types";

const TYPES = new Set<CallbackType>(["COMPLETE", "START_BONUS", "RECONCILIATION", "SCREENOUT"]);

export type PostbackParams = {
  uid?: string;
  tx?: string;
  val?: string;
  raw?: string;
  type?: string;
  ref?: string;
  survey_id?: string;
  reason?: string;
};

export type ProcessPostbackInput = {
  fullUrl: string;
  secret: string;
  params: PostbackParams;
  currencyCode: string;
  minorUnitFactor: number;
};

export type ProcessPostbackResult = {
  httpStatus: number;
  outcome: PostbackOutcome;
};

export async function processPostback(
  store: RewardStore,
  input: ProcessPostbackInput,
): Promise<ProcessPostbackResult> {
  if (!verifyBitlabsHash(input.fullUrl, input.secret)) {
    await store.recordRejection({
      outcome: "INVALID_SIGNATURE",
      providerTxId: clean(input.params.tx) ?? undefined,
      type: clean(input.params.type) ?? undefined,
      userId: clean(input.params.uid) ?? undefined,
    });
    return { httpStatus: 401, outcome: "INVALID_SIGNATURE" };
  }

  const parsed = parseCallback(input);
  if (!parsed.ok) {
    await store.recordRejection({
      outcome: "INVALID_PAYLOAD",
      providerTxId: clean(input.params.tx) ?? undefined,
      type: clean(input.params.type) ?? undefined,
      userId: clean(input.params.uid) ?? undefined,
    });
    return { httpStatus: 400, outcome: "INVALID_PAYLOAD" };
  }

  const result = await store.apply(parsed.event);
  if (result.outcome === "ACCEPTED") return { httpStatus: 200, outcome: "ACCEPTED" };
  if (result.outcome === "DUPLICATE") return { httpStatus: 200, outcome: "DUPLICATE" };
  if (result.outcome === "UNKNOWN_USER") return { httpStatus: 200, outcome: "UNKNOWN_USER" };
  return { httpStatus: 200, outcome: "UNSUPPORTED_EVENT" };
}

function parseCallback(
  input: ProcessPostbackInput,
): { ok: true; unsupported: boolean; event: ValidatedCallback } | { ok: false } {
  const userId = clean(input.params.uid);
  const providerTxId = clean(input.params.tx);
  const typeRaw = clean(input.params.type)?.toUpperCase();
  if (!userId || !providerTxId || !typeRaw || userId.length > 255 || providerTxId.length > 255) {
    return { ok: false };
  }

  const known = TYPES.has(typeRaw as CallbackType);
  const type = (known ? typeRaw : "SCREENOUT") as CallbackType;
  const amount = amountFor(typeRaw, input.params.val, input.minorUnitFactor, known);
  if (amount === null) return { ok: false };

  return {
    ok: true,
    unsupported: !known,
    event: {
      userId,
      providerTxId,
      type,
      amountUnits: amount,
      currencyCode: input.currencyCode,
      surveyId: clean(input.params.survey_id),
      refTxId: clean(input.params.ref),
      reason: clean(input.params.reason),
      providerUsd: clean(input.params.raw),
      disposition: known ? "reward" : "unsupported",
    },
  };
}

function amountFor(type: string, raw: string | undefined, factor: number, known: boolean): number | null {
  if (!known) return 0;
  if (type === "SCREENOUT") {
    if (raw === undefined || raw.trim() === "") return 0;
    const parsed = parseRewardUnits(raw, factor);
    return parsed === null ? null : 0;
  }
  if (raw === undefined) return null;
  const parsed = parseRewardUnits(raw, factor);
  if (parsed === null) return null;
  if ((type === "COMPLETE" || type === "START_BONUS") && parsed < 0) return null;
  if (type === "RECONCILIATION" && parsed === 0) return null;
  return parsed;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
