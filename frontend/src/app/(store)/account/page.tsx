import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { AccountProfile } from "@/components/auth/account-profile";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser({ kind: "page", next: "/account" });
  return <AccountProfile user={user} />;
}
