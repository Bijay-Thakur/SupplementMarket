"use client";

import { useRouter } from "next/navigation";
import { features } from "@/lib/config/features";
import { useDemoRole } from "./role-provider";

/**
 * Development-only welcome modal. Not authentication and not secure.
 * Gated by NEXT_PUBLIC_DEMO_ROLE_SELECTOR_ENABLED so it can be removed
 * without rewriting admin pages.
 */
export function RoleChooser() {
  const { role, setRole } = useDemoRole();
  const router = useRouter();

  if (!features.demoRoleSelector) return null;
  if (role) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:var(--brand-ink)]/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-chooser-title"
    >
      <div className="w-full max-w-md rounded-[--radius-xl] bg-surface p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-magenta)]">
          Demo mode
        </p>
        <h1
          id="role-chooser-title"
          className="mt-2 font-display text-2xl font-semibold text-[color:var(--brand-ink)]"
        >
          Welcome to Bronxville Natural Market
        </h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          This is a local demonstration. Choosing a role only changes which
          screens you see — it is not a login and is not secure.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="h-12 rounded-[--radius] bg-[color:var(--brand-magenta)] text-sm font-semibold text-white hover:bg-[color:var(--brand-magenta-strong)]"
            onClick={() => {
              setRole("customer");
              router.push("/");
            }}
          >
            Continue as Customer
          </button>
          <button
            type="button"
            className="h-12 rounded-[--radius] bg-[color:var(--brand-green)] text-sm font-semibold text-white hover:bg-[color:var(--brand-green-strong)]"
            onClick={() => {
              setRole("admin");
              router.push("/admin");
            }}
          >
            Continue as Admin
          </button>
        </div>
      </div>
    </div>
  );
}
