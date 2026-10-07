import { PolicyShell } from "@/components/ui/policy-shell";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "Returns",
  "How returns work at Bronxville Natural Market.",
  "/returns",
);

export default function ReturnsPage() {
  return (
    <PolicyShell title="Returns">
      <p>Placeholder return policy. Final wording is provided by the owner.</p>
    </PolicyShell>
  );
}
