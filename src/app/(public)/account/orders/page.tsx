import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { features } from "@/lib/config/features";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = {
  title: "Order history",
  robots: { index: false },
};

export default function AccountOrdersPage() {
  if (!features.customerAuth) redirect("/");
  return (
    <PagePlaceholder
      title="Order history"
      description="Your past orders and their status."
      phase="Phase 6"
    />
  );
}
