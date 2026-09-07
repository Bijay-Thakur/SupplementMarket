"use client";

import { useCallback, useEffect, useRef, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import {
  type EntryMode,
  readEntryMode,
  writeEntryMode,
  clearEntryMode,
} from "@/lib/entry-mode";

/**
 * Unauthenticated `/` gate. sessionStorage (and a UI-only cookie mirror) remember
 * the choice for this tab. Neither grants a role nor a Supabase session.
 */
export function EntryExperience() {
  const router = useRouter();

  useEffect(() => {
    const stored = readEntryMode();
    if (stored === "guest") {
      writeEntryMode("guest");
      router.refresh();
      return;
    }
    if (stored === "customer") {
      writeEntryMode("customer");
      router.replace("/auth/sign-in");
      return;
    }
    if (stored === "admin") {
      writeEntryMode("admin");
      router.replace("/admin/login");
    }
  }, [router]);

  return <EntryScreen />;
}

function EntryScreen() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  const choose = useCallback(
    (mode: EntryMode) => {
      writeEntryMode(mode);
      if (mode === "guest") router.refresh();
      if (mode === "customer") router.push("/auth/sign-in");
      if (mode === "admin") router.push("/admin/login");
    },
    [router],
  );

  useEffect(() => {
    firstButtonRef.current?.focus();
    const node = dialogRef.current;
    if (!node) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        choose("guest");
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [choose]);

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--brand-cream)]">
      <div className="flex justify-center px-4 pt-10">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div
          ref={dialogRef}
          className="w-full max-w-md rounded-[--radius-xl] bg-surface p-8 shadow-xl outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-chooser-title"
          aria-describedby="entry-chooser-copy"
        >
          <h1
            id="entry-chooser-title"
            className="font-display text-2xl font-semibold text-[color:var(--brand-ink)]"
          >
            How would you like to continue?
          </h1>
          <p id="entry-chooser-copy" className="mt-3 text-sm text-[color:var(--muted)]">
            Choose how you want to use Bronxville Natural Market. This choice is
            stored only in this browser tab and does not sign you in.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <ChoiceButton
              ref={firstButtonRef}
              title="Continue as Guest"
              description="Browse products and store information without signing in."
              variant="magenta"
              onClick={() => choose("guest")}
            />
            <ChoiceButton
              title="Continue as Customer"
              description="Sign in or create an account to manage your profile and future orders."
              variant="green"
              onClick={() => choose("customer")}
            />
            <ChoiceButton
              title="Continue as Admin"
              description="Access catalog and store-management tools."
              variant="outline"
              onClick={() => choose("admin")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const ChoiceButton = forwardRef<
  HTMLButtonElement,
  {
    title: string;
    description: string;
    variant: "magenta" | "green" | "outline";
    onClick: () => void;
  }
>(function ChoiceButton({ title, description, variant, onClick }, ref) {
  const styles =
    variant === "magenta"
      ? "bg-[color:var(--brand-magenta)] text-white hover:bg-[color:var(--brand-magenta-strong)]"
      : variant === "green"
        ? "bg-[color:var(--brand-green)] text-white hover:bg-[color:var(--brand-green-strong)]"
        : "border border-[color:var(--border)] bg-surface text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`rounded-[--radius] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-gold)] ${styles}`}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className={`mt-1 block text-xs ${variant === "outline" ? "text-[color:var(--muted)]" : "text-white/90"}`}>
        {description}
      </span>
    </button>
  );
});

export function SwitchExperienceButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={
        className ??
        "rounded-[--radius] px-2 py-1 text-xs font-medium text-[color:var(--muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      }
      onClick={() => {
        clearEntryMode();
        if (window.location.pathname === "/") router.refresh();
        else router.push("/");
      }}
    >
      Switch experience
    </button>
  );
}
