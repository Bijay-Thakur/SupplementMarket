import type { Metadata } from "next";
import { PolicyShell } from "@/components/ui/policy-shell";

export const metadata: Metadata = { title: "Returns" };

export default function ReturnsPage() {
  return (
    <PolicyShell title="Returns">
      <p>Placeholder return policy. Final wording is provided by the owner.</p>
    </PolicyShell>
  );
}
