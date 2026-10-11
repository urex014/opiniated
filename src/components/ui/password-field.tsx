"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordField({
  label,
  name,
  autoComplete,
  error,
  hint,
  hintId,
  visibilityLabel,
  onChange,
  onBlur,
}: {
  label: string;
  name: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  hintId?: string;
  visibilityLabel?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const id = name;
  const describedBy = [error ? `${id}-error` : null, hint && hintId ? hintId : null].filter(Boolean).join(" ") || undefined;
  const noun = visibilityLabel ?? label.toLowerCase();

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="field-input pr-12"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition-[color] duration-150 hover:text-ink"
          aria-label={visible ? `Hide ${noun}` : `Show ${noun}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <span className="relative block h-[18px] w-[18px]" aria-hidden="true">
            <Eye
              size={18}
              strokeWidth={1.75}
              className={`absolute inset-0 transition-[opacity,transform,filter] duration-150 ${visible ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-none"}`}
            />
            <EyeOff
              size={18}
              strokeWidth={1.75}
              className={`absolute inset-0 transition-[opacity,transform,filter] duration-150 ${visible ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-[4px]"}`}
            />
          </span>
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
