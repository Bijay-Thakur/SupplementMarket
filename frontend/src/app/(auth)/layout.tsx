import { AuthShellHeader } from "@/components/auth/auth-shell-header";

/**
 * Minimal authentication shell. No cart, store nav, admin sidebar, or banners.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--brand-cream)]">
      <AuthShellHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
