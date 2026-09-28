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
      <label htmlFor={id} className="text-sm font-semibold text-[color:var(--brand-ink)]">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={name ?? id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          {...(controlled ? { value, onChange: (e) => onChange(e.target.value) } : {})}
          className="block h-12 w-full rounded-[--radius] border border-[color:var(--brand-green)]/40 bg-white px-4 pr-20 shadow-[inset_0_1px_2px_rgba(24,48,27,0.05)] outline-none transition focus:border-[color:var(--brand-magenta)] focus:ring-2 focus:ring-[color:var(--brand-magenta)]/15"
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
