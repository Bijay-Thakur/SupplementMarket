import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminAccountMenu } from "@/components/admin/admin-account-menu";
import { Logo } from "@/components/layout/logo";
import { requireAdmin } from "@/lib/auth/server";
import { SignOutForm } from "@/components/auth/sign-out-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin({ kind: "page", next: "/admin" });

  return (
    <div className="flex min-h-screen bg-[color:var(--brand-cream)]">
      <aside className="hidden w-56 shrink-0 border-r border-[color:var(--border)] bg-surface p-4 md:block">
        <Logo href="/admin" />
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-magenta)]">
          Administrator
        </p>
        <p className="mt-2 truncate text-[11px] text-[color:var(--muted)]">{user.email}</p>
        <div className="mt-4">
          <AdminNav />
        </div>
        <div className="mt-6 space-y-2">
          <AdminAccountMenu email={user.email} />
          <SignOutForm
            next="/"
            className="w-full rounded-[--radius] px-3 py-2 text-left text-xs text-[color:var(--muted)] hover:bg-[color:var(--brand-cream)] hover:underline"
          >
            Sign Out
          </SignOutForm>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[color:var(--border)] bg-surface px-3 py-2 md:hidden">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-magenta)]">
            Admin
          </p>
          <p className="mb-2 truncate text-[11px] text-[color:var(--muted)]">{user.email}</p>
          <AdminNav />
          <div className="mt-2 space-y-2">
            <AdminAccountMenu email={user.email} />
            <SignOutForm next="/" className="mt-2 text-xs text-[color:var(--muted)] hover:underline">
              Sign Out
            </SignOutForm>
          </div>
        </div>
        <main id="main-content" className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
