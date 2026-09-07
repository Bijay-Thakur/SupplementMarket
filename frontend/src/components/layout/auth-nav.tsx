import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { AccountMenu } from "./account-menu";

export async function AuthNav() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <div className="hidden items-center gap-2 lg:flex">
        <Link
          href="/auth/sign-in"
          className="rounded-[--radius] px-3 py-2 text-sm font-medium text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]"
        >
          Sign In
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-[--radius] bg-[color:var(--brand-magenta)] px-3 py-2 text-sm font-semibold text-white hover:bg-[color:var(--brand-magenta-strong)]"
        >
          Create Account
        </Link>
      </div>
    );
  }
  return (
    <div className="hidden lg:block">
      <AccountMenu email={user.email} />
    </div>
  );
}
