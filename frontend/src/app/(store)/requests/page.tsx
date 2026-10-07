"use client";

import { useState } from "react";
import { LoaderCircle, PackagePlus } from "lucide-react";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";

const fields = [
  ["supplement_name", "Supplement name", true, 200], ["brand", "Brand", false, 120],
  ["upc", "UPC / barcode", false, 14], ["size", "Size / count", false, 100],
  ["strength", "Strength (e.g. 500 mg)", false, 100], ["form", "Form (e.g. capsules, liquid)", false, 100],
  ["customer_name", "Your name", true, 120], ["email", "Email", true, 254], ["phone", "Phone (optional)", false, 32],
] as const;

export default function RequestsPage() {
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  return <Container className="max-w-3xl py-10 sm:py-14">
    <div className="mb-7"><PackagePlus className="mb-3 h-9 w-9 text-[color:var(--brand-green)]" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-magenta)]">Something special, just for you</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Special requests</h1>
      <p className="mt-3 text-[color:var(--muted)]">Looking for a supplement we don’t carry? Tell us what you need. Our team will check availability and contact you. No account is needed.</p>
    </div>
    {complete ? <section role="status" className="rounded-2xl border border-[color:var(--border)] bg-white p-8 shadow-sm">
      <h2 className="font-display text-2xl">Your request is with our team.</h2>
      <p className="mt-3">We’ll contact you about availability and pricing. This is an inquiry, not a confirmed order or payment.</p>
      <button className={`${buttonVariants()} mt-6`} onClick={() => { setComplete(false); setRequestKey(null); }}>Send another request</button>
    </section> : <form className="grid gap-5 rounded-2xl border border-[color:var(--border)] bg-white p-6 shadow-sm sm:grid-cols-2 sm:p-8" onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      setPending(true); setError(null);
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const key = requestKey ?? crypto.randomUUID(); setRequestKey(key);
      try {
        const response = await fetch("/api/supplement-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, request_key: key }) });
        const data = await response.json();
        if (!response.ok) { setError(data.detail || "Could not submit your request."); return; }
        setComplete(true);
      } catch { setError("Connection interrupted. Please try again; resubmitting will not create a duplicate."); }
      finally { setPending(false); }
    }}>
      <p className="text-sm text-[color:var(--muted)] sm:col-span-2">* Required. Leave product details blank if you’re unsure.</p>
      {fields.map(([name, label, required, max]) => <label key={name} className="block text-sm font-medium" htmlFor={name}>{label}{required ? " *" : ""}
        <input id={name} name={name} required={required} maxLength={max} disabled={pending} type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} autoComplete={name === "email" ? "email" : name === "customer_name" ? "name" : name === "phone" ? "tel" : "off"} className="mt-2 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 focus:border-[color:var(--brand-green)] focus:outline-2 focus:outline-[color:var(--brand-green)]" />
      </label>)}
      <label className="text-sm font-medium sm:col-span-2" htmlFor="notes">Additional details (optional)<textarea id="notes" name="notes" maxLength={1000} disabled={pending} rows={3} className="mt-2 w-full rounded-xl border border-stone-300 p-3" /></label>
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <p className="text-xs text-[color:var(--muted)] sm:col-span-2">Your contact details are only used to follow up on this request. Please don’t include medical or other sensitive information.</p>
      {error && <p role="alert" className="text-sm text-[color:var(--danger)] sm:col-span-2">{error}</p>}
      <button disabled={pending} className={`${buttonVariants({ size: "lg" })} sm:col-span-2`}>{pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />}{pending ? "Sending request…" : "Send special request"}</button>
    </form>}
  </Container>;
}
