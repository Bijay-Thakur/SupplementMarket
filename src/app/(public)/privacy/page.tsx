import type { Metadata } from "next";
import { PolicyShell } from "@/components/ui/policy-shell";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <PolicyShell title="Privacy Policy">
      <p>
        This placeholder describes how {""}Bronxville Natural Market will handle
        personal information. Final wording is provided by the owner before
        launch.
      </p>
    </PolicyShell>
  );
}
