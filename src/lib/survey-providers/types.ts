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

export type SurveyFetchError =
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "malformed"
  | "not_configured";

export type SurveyFetchResult =
  | { ok: true; providerId: string; surveys: ProviderSurvey[]; restriction: SurveyRestriction | null }
  | { ok: false; error: SurveyFetchError };

export type ProviderCapabilities = {
  surveyList: boolean;
  hostedOfferwall: boolean;
  signedPostback: boolean;
};

export type RegisteredProvider = {
  id: string;
  displayName: string;
  configured: boolean;
  enabled: boolean;
  configError: string | null;
  capabilities: ProviderCapabilities;
};

export function toPublicSurveys(surveys: ProviderSurvey[]): PublicSurvey[] {
  return surveys.map((survey) => ({
    id: survey.id,
    type: survey.type,
    title: survey.title,
    rewardUnits: survey.rewardUnits,
    rewardLabel: survey.rewardLabel,
    durationMinutes: survey.durationMinutes,
    rating: survey.rating,
    country: survey.country,
    category: survey.category,
    tags: survey.tags,
  }));
}
