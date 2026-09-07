import type { Metadata } from "next";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <Container className="max-w-lg py-12">
        <h1 className="font-display text-3xl font-semibold">Sign in to place an order</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          You can browse products without an account. To place an order, sign in
          or create an account, then provide a phone number and address.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/auth/sign-in?next=/checkout" className={buttonVariants()}>
            Sign In
          </Link>
          <Link href="/auth/sign-up?next=/checkout" className={buttonVariants({ variant: "outline" })}>
            Create Account
          </Link>
        </div>
      </Container>
    );
  }
  return <CheckoutForm user={user} />;
}
