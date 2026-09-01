"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Root error boundary. Shows a generic message with a correlation-friendly
 * digest (never internal details) and logs to the console for local debugging.
 * Production wires this to the error-monitoring adapter in Phase 7.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-semibold text-[color:var(--brand-ink)]">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-[color:var(--muted)]">
        We hit an unexpected error. Please try again. If it keeps happening,
        contact the store.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className={buttonVariants({ variant: "primary" })}
        >
          Try again
        </button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
