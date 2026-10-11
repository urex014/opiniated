export function Field({
  label,
  name,
  type = "text",
  error,
  autoComplete,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  const id = name;
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-10 rounded-md border border-line bg-white px-3 text-base text-ink"
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormNote({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-md border border-line bg-white px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-md border border-line bg-success-bg px-3 py-2 text-sm text-ink">
        {message}
      </p>
    );
  }
  return null;
}
