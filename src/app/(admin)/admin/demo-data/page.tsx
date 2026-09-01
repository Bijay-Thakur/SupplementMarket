"use client";

import { useState } from "react";
import { resetDemo } from "@/lib/api/catalog";
import { buttonVariants } from "@/components/ui/button";

export default function DemoDataPage() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl font-semibold">Demo data</h1>
      <p className="mt-3 text-sm text-[color:var(--muted)]">
        Reset restores the bundled demonstration catalog. Session orders are
        cleared. This is safe to click during a walkthrough.
      </p>
      <button
        type="button"
        className={`${buttonVariants({ variant: "outline" })} mt-6`}
        onClick={() => {
          if (!confirm("Reset demonstration data only?")) return;
          resetDemo().then((r) => setMsg(r.message ?? "Reset complete."));
        }}
      >
        Reset demo catalog
      </button>
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </div>
  );
}
