export type PublicSurvey = {
  id: string;
  type: "survey" | "start_bonus";
  title: string;
  rewardUnits: number;
  rewardLabel: string;
  durationMinutes: number | null;
  rating: number | null;
  country: string | null;
  category: string | null;
  tags: Array<"pii" | "recontact">;
};

export type ProviderSurvey = PublicSurvey & {
  clickUrl: string;
};

export type SurveyRestriction = {
  code:
    | "not_verified"
    | "using_vpn"
    | "unsupported_country"
    | "banned"
    | "review"
    | "on_hold"
    | "banned_until";
  message: string;
};

export type SurveyFetchResult =
  | { ok: true; surveys: ProviderSurvey[]; restriction: SurveyRestriction | null }
  | {
      ok: false;
      error: "unauthorized" | "rate_limited" | "timeout" | "unavailable" | "malformed" | "not_configured";
    };
