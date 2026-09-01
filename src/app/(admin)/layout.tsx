import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Admin shell. DEVELOPMENT-ONLY authorization in this phase — the role chooser
 * is not authentication. These pages must sit behind Supabase auth +
 * server-verified roles before deployment.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[color:var(--brand-cream)]">
      <aside className="hidden w-56 shrink-0 border-r border-[color:var(--border)] bg-surface p-4 md:block">
        <Logo markSize={36} />
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-magenta)]">
          Admin (demo — not secure)
        </p>
        <div className="mt-4">
          <AdminNav />
        </div>
        <Link href="/" className="mt-8 block text-xs text-[color:var(--muted)] hover:underline">
          ← Storefront
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[color:var(--border)] bg-surface px-3 py-2 md:hidden">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-magenta)]">
            Admin (demo)
          </p>
          <AdminNav />
        </div>
        <main id="main-content" className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
