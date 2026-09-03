import type { Metadata } from "next";
import { PolicyShell } from "@/components/ui/policy-shell";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <PolicyShell title="Terms of Service">
      <p>Placeholder terms. Final wording is provided by the owner.</p>
    </PolicyShell>
  );
}
