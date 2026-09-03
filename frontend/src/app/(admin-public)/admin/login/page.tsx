import type { Metadata } from "next";
import { Suspense } from "react";
import SignInForm from "@/components/auth/sign-in-form";
import { getUserFromCookieStore } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage() {
  const user = await getUserFromCookieStore();
  if (user?.role === "admin") redirect("/admin");
  return (
    <Suspense>
      <SignInForm admin />
    </Suspense>
  );
}
