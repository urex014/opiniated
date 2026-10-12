import type { RegisteredProvider } from "@/lib/survey-providers/types";

export const CPX_PROVIDER_ID = "cpx";
export const CPX_DISPLAY_NAME = "CPX Research";

const CLICK_HOST = "click.cpx-research.com";

export type ProviderEnv = {
  cpxAppId: string | null;
  cpxSecureHash: string | null;
  cpxEnabled: boolean;
};

export function listSurveyProviders(env: ProviderEnv): RegisteredProvider[] {
  const configured = Boolean(env.cpxAppId && env.cpxSecureHash);
  const enabled = configured && env.cpxEnabled;
  return [
    {
      id: CPX_PROVIDER_ID,
      displayName: CPX_DISPLAY_NAME,
      configured,
      enabled,
      configError:
        env.cpxEnabled && !configured
          ? "CPX Research is marked enabled, but the app id or secure hash is missing."
          : null,
      capabilities: {
        surveyList: true,
        hostedOfferwall: false,
        signedPostback: true,
      },
    },
  ];
}

export function activeSurveyProvider(env: ProviderEnv) {
  return listSurveyProviders(env).find((provider) => provider.enabled) ?? null;
}

export function isCpxLaunchUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.hostname === CLICK_HOST && url.searchParams.has("k");
}

/** Only the enabled provider's documented entry links may be followed. */
export function activeLaunchAllowed(value: string, env: ProviderEnv): boolean {
  const active = activeSurveyProvider(env);
  if (!active || active.id !== CPX_PROVIDER_ID) return false;
  return isCpxLaunchUrl(value);
}
