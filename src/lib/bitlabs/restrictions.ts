import type { SurveyRestriction } from "@/lib/bitlabs/types";

export function restrictionFromPayload(value: unknown): SurveyRestriction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.banned === true) {
    return { code: "banned", message: "This account cannot access surveys right now." };
  }
  if (typeof record.banned_until === "string" && record.banned_until) {
    return {
      code: "banned_until",
      message: `Survey access is paused until ${record.banned_until}.`,
    };
  }
  if (record.not_verified === true) {
    return {
      code: "not_verified",
      message: "The survey provider has not verified this publisher account, so surveys are unavailable.",
    };
  }
  if (typeof record.unsupported_country === "string" && record.unsupported_country) {
    return {
      code: "unsupported_country",
      message: "Surveys are not available from the country associated with this connection.",
    };
  }
  if (record.unsupported_country === true) {
    return {
      code: "unsupported_country",
      message: "Surveys are not available from the country associated with this connection.",
    };
  }
  if (record.using_vpn === true) {
    return {
      code: "using_vpn",
      message: "Surveys are unavailable while a VPN is detected. Disconnect it and try again.",
    };
  }
  if (record.review === true) {
    return { code: "review", message: "Survey access is temporarily under review." };
  }
  if (record.on_hold === true) {
    return { code: "on_hold", message: "Survey access is temporarily paused." };
  }
  return null;
}
