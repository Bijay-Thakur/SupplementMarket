import Link from "next/link";
import { Container } from "@/components/ui/container";
import { FOOTER_NAV } from "@/lib/config/navigation";
import { DEFAULT_STORE_CONFIG, formatAddress } from "@/lib/config/store";
import { Logo } from "./logo";
import { PhoneCta } from "./phone-cta";

export function SiteFooter() {
  const store = DEFAULT_STORE_CONFIG;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[color:var(--border)] bg-surface">
      <Container className="grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <address className="mt-4 not-italic text-sm text-[color:var(--muted)]">
            {formatAddress(store.address)}
          </address>
          <div className="mt-3">
            <PhoneCta />
          </div>
        </div>

        {FOOTER_NAV.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-ink)]">
              {group.heading}
            </h2>
            <ul className="mt-4 space-y-2">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[color:var(--muted)] hover:text-[color:var(--brand-magenta)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t border-[color:var(--border)]">
        <Container className="flex flex-col gap-2 py-4 text-xs text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {store.legalName}. All rights reserved.
          </p>
          <p className="max-w-2xl">
            These statements have not been evaluated by the Food and Drug
            Administration. Products are not intended to diagnose, treat, cure,
            or prevent any disease.
          </p>
        </Container>
      </div>
    </footer>
  );
}
