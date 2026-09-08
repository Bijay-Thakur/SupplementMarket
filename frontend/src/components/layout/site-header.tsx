import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { PRIMARY_NAV } from "@/lib/config/navigation";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { HeaderSearch } from "./header-search";
import { CartLink } from "./cart-link";
import { AuthNav } from "./auth-nav";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { SwitchExperienceButton } from "@/components/entry/entry-experience";

/** Responsive storefront header. Server component; interactive bits are islands. */
export async function SiteHeader() {
  const user = await getAuthenticatedUser();
  const guest = !user;
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-surface/95 backdrop-blur">
      <Container className="flex h-16 items-center gap-4 lg:h-20">
        <Logo />

        <nav
          className="ml-4 hidden items-center gap-1 lg:flex"
          aria-label="Primary"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[--radius] px-3 py-2 text-sm font-medium text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden max-w-xs flex-1 md:block">
          <Suspense fallback={<SearchFallback />}>
            <HeaderSearch />
          </Suspense>
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-2">
          {user ? <CartLink /> : null}
          <AuthNav />
          {guest ? (
            <div className="hidden lg:block">
              <SwitchExperienceButton />
            </div>
          ) : null}
          <MobileNav signedIn={Boolean(user)} email={user?.email ?? null} />
        </div>
      </Container>

      <div className="border-t border-[color:var(--border)] px-4 py-2 md:hidden">
        <Suspense fallback={<SearchFallback />}>
          <HeaderSearch />
        </Suspense>
      </div>
    </header>
  );
}

function SearchFallback() {
  return (
    <div
      className="h-11 w-full rounded-full border border-[color:var(--border)] bg-surface"
      aria-hidden
    />
  );
}
