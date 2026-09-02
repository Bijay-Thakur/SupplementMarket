"use client";

import { useRouter } from "next/navigation";
import { features } from "@/lib/config/features";
import { useDemoRole } from "./role-provider";

export function DemoModeBar() {
  const { role, switchRole } = useDemoRole();
  const router = useRouter();
  if (!features.demoRoleSelector || !role) return null;

  return (
    <div className="bg-[color:var(--brand-ink)] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs">
        <p>
          <span className="font-semibold">Demo mode</span>
          {" — "}
          viewing as {role}. Not a login. Demonstration catalog only.
        </p>
        <button
          type="button"
          className="shrink-0 rounded-full border border-white/30 px-3 py-1 font-semibold hover:bg-white/10"
          onClick={async () => {
            await fetch("/api/auth?action=sign-out", { method: "POST", credentials: "include" });
            switchRole();
            router.push("/");
            router.refresh();
          }}
        >
          Switch role
        </button>
      </div>
    </div>
  );
}
