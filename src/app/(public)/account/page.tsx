import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { features } from "@/lib/config/features";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  if (!features.customerAuth) redirect("/");
  return (
    <PagePlaceholder
      title="Your account"
      description="Manage your profile and view your orders."
      phase="Phase 6"
    />
  );
}
