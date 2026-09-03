import type { Metadata } from "next";
import SignUpForm from "@/components/auth/sign-up-form";
import { features } from "@/lib/config/features";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage() {
  if (!features.customerAuth && !features.mockAuth) redirect("/");
  return <SignUpForm />;
}
