import Link from "next/link";
import type { SurveyRestriction } from "@/lib/bitlabs/types";

export function SurveySkeleton() {
  return (
    <div className="border-y border-line bg-white" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="border-b border-line px-4 py-4 last:border-b-0">
          <div className="h-4 w-48 rounded-sm bg-surface" />
          <div className="mt-2 h-3 w-32 rounded-sm bg-surface" />
        </div>
      ))}
    </div>
  );
}

export function EmptySurveys({ restriction }: { restriction: SurveyRestriction | null }) {
  return (
    <div className="border border-line bg-white px-4 py-6">
      <h2 className="text-lg font-medium text-ink">
        {restriction ? "Surveys are unavailable" : "No surveys available right now"}
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        {restriction?.message ??
          "Survey availability can change throughout the day. Check back later for new opportunities."}
      </p>
      <Link href="/surveys" className="mt-4 inline-flex h-10 items-center rounded-md border border-line px-3 text-sm font-medium">
        Refresh surveys
      </Link>
    </div>
  );
}

const errorCopy: Record<string, string> = {
  unauthorized: "Surveys could not be loaded. The provider rejected the request.",
  rate_limited: "The survey provider is limiting requests. Wait a moment, then try again.",
  timeout: "The survey provider took too long to respond.",
  unavailable: "Surveys could not be loaded. The provider is temporarily unavailable.",
  malformed: "Surveys could not be loaded because the provider response was not usable.",
  not_configured: "Surveys are not available until the site operator adds BitLabs credentials.",
  missing: "That survey is no longer available. Refresh the list and choose another.",
  load: "Surveys could not be loaded, so this one could not be started.",
  rate: "Too many survey starts in a short time. Wait a moment and try again.",
};

export function SurveyError({ code }: { code: string }) {
  return (
    <div className="border border-line bg-white px-4 py-6" role="alert">
      <h2 className="text-lg font-medium text-ink">Surveys could not be loaded</h2>
      <p className="mt-2 text-sm text-muted">{errorCopy[code] ?? errorCopy.unavailable}</p>
      <Link href="/surveys" className="mt-4 inline-flex h-10 items-center rounded-md border border-line px-3 text-sm font-medium">
        Retry
      </Link>
    </div>
  );
}
