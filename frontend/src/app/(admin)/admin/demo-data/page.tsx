"use client";

import { useState } from "react";
import { resetDemo } from "@/lib/api/catalog";
import { buttonVariants } from "@/components/ui/button";

export default function SampleCatalogPage() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl font-semibold">Sample catalog</h1>
      <p className="mt-3 text-sm text-[color:var(--muted)]">
        Reset restores the bundled sample catalog snapshot and clears session
        orders. Use this only while catalog data is still being verified.
      </p>
      <button
        type="button"
        className={`${buttonVariants({ variant: "outline" })} mt-6`}
        onClick={() => {
          if (!confirm("Reset the sample catalog snapshot?")) return;
          resetDemo().then((r) => setMsg(r.message ?? "Reset complete."));
        }}
      >
        Reset sample catalog
      </button>
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </div>
  );
}
