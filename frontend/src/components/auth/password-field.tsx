"use client";

import { useState } from "react";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  error,
  name,
}: {
  id: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  error?: string;
  name?: string;
}) {
  const [show, setShow] = useState(false);
  const controlled = value !== undefined && onChange;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name ?? id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          {...(controlled ? { value, onChange: (e) => onChange(e.target.value) } : {})}
          className="block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3 pr-20"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-[color:var(--brand-magenta)]"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide characters" : "Show characters"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-[color:var(--danger)]">{error}</p>}
    </div>
  );
}
