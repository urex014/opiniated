import { processCpxPostback } from "@/lib/survey-providers/providers/cpx/callback";
import { fetchCpxSurveys } from "@/lib/survey-providers/providers/cpx/client";
import { CPX_DISPLAY_NAME, CPX_PROVIDER_ID, isCpxLaunchUrl } from "@/lib/survey-providers/registry";

/** CPX Research adapter. Shared reward and survey code should use the registry, not this file. */
export const cpxProvider = {
  id: CPX_PROVIDER_ID,
  displayName: CPX_DISPLAY_NAME,
  fetchSurveys: fetchCpxSurveys,
  isLaunchUrl: isCpxLaunchUrl,
  processPostback: processCpxPostback,
};
