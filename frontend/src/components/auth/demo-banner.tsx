import Link from "next/link";
import { features } from "@/lib/config/features";

export function DemoAuthBanner() {
  if (!features.mockAuth) return null;
  return (
    <p className="rounded-[--radius] border border-dashed border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-4 py-3 text-sm">
      <strong>Demo authentication — not a real account.</strong> Passwords are
      not stored. No email is sent. This walkthrough is not connected to Google
      or live customer data.{" "}
      <Link href="/privacy" className="underline">
        Privacy
      </Link>
    </p>
  );
}
