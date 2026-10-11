export function StepList({ steps }: { steps: { title?: string; text: string }[] }) {
  return (
    <ol>
      {steps.map((step, index) => (
        <li key={`${step.title ?? "step"}-${index}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-b border-line py-4 last:border-b-0">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand text-sm font-medium text-white" aria-hidden="true">
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            {step.title ? <h3 className="text-base font-medium text-ink">{step.title}</h3> : null}
            <p className={`text-sm leading-6 ${step.title ? "mt-1 text-muted" : "text-ink"}`}>{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
