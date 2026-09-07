import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignUpForm from "@/components/auth/sign-up-form";
import { features } from "@/lib/config/features";
import { getAuthenticatedUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (!features.customerAuth) redirect("/");
  const user = await getAuthenticatedUser();
  if (user?.role === "admin") redirect("/admin");
  if (user) redirect("/account");
  return <SignUpForm />;
}
