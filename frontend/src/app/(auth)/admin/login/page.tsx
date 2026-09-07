import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/sign-in-form";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { ADMIN_FORBIDDEN_MESSAGE } from "@/lib/auth/types";
import { Container } from "@/components/ui/container";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await getAuthenticatedUser();
  if (user?.role === "admin") redirect("/admin");
  if (user) {
    return (
      <Container className="max-w-md py-12">
        <h1 className="font-display text-3xl font-semibold">Admin sign in</h1>
        <p className="mt-3 text-sm text-[color:var(--danger)]">{ADMIN_FORBIDDEN_MESSAGE}</p>
        <p className="mt-6 text-sm">
          <Link href="/account" className="text-[color:var(--brand-magenta)] underline">
            Go to your account
          </Link>
        </p>
      </Container>
    );
  }
  return (
    <Suspense>
      <SignInForm admin />
    </Suspense>
  );
}
