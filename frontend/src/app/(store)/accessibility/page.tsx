import { PolicyShell } from "@/components/ui/policy-shell";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "Accessibility",
  "Accessibility commitments for the Bronxville Natural Market website.",
  "/accessibility",
);

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
