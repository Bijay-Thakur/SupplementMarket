import type { Metadata } from "next";
import { Suspense } from "react";
import SignInForm from "@/components/auth/sign-in-form";
import { features } from "@/lib/config/features";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  if (!features.customerAuth && !features.mockAuth) redirect("/");
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
