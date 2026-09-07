import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/sign-in-form";
import { features } from "@/lib/config/features";
import { getAuthenticatedUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (!features.customerAuth) redirect("/");
  const user = await getAuthenticatedUser();
  if (user?.role === "admin") redirect("/admin");
  if (user) redirect("/account");
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
