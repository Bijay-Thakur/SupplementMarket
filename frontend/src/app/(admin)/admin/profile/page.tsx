import type { Metadata } from "next";
import { AccountProfile } from "@/components/auth/account-profile";
import { requireAdmin } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Administrator profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const user = await requireAdmin({ kind: "page", next: "/admin/profile" });
  return <AccountProfile user={user} />;
}
