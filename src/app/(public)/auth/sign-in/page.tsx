import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { features } from "@/lib/config/features";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Customer sign-in. Fully built in Phase 6 (Google OAuth). While customer auth
 * is disabled we redirect to home so the route never dead-ends on a login the
 * user cannot complete.
 */
export default function SignInPage() {
  if (!features.customerAuth) redirect("/");
  return (
    <PagePlaceholder
      title="Sign in"
      description="Sign in with Google to view your account and order history."
      phase="Phase 6"
    />
  );
}
