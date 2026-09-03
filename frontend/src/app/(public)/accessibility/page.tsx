import type { Metadata } from "next";
import { PolicyShell } from "@/components/ui/policy-shell";

export const metadata: Metadata = { title: "Accessibility" };

export default function AccessibilityPage() {
  return (
    <PolicyShell title="Accessibility">
      <p>
        Bronxville Natural Market is committed to an accessible, WCAG 2.2
        AA-aligned experience. This statement will be finalized by the owner and
        include a contact method for accessibility issues.
      </p>
    </PolicyShell>
  );
}
