import { readEnv, type AppEnv } from "@/lib/env";
import { activeLaunchAllowed } from "@/lib/survey-providers/registry";

export function isAllowedSurveyClickUrl(value: string, env: AppEnv = readEnv()): boolean {
  return activeLaunchAllowed(value, env);
}
