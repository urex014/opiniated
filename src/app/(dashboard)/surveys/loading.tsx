import { SurveySkeleton } from "@/components/surveys/survey-states";

export default function SurveysLoading() {
  return (
    <>
      <h1 className="text-[28px] font-medium">Available surveys</h1>
      <p className="mt-1 text-sm text-muted">Loading surveys for your account.</p>
      <div className="mt-5">
        <SurveySkeleton />
      </div>
    </>
  );
}
