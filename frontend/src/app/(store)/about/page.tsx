import { Container } from "@/components/ui/container";
import { DEFAULT_STORE_CONFIG, formatAddress, formatHours } from "@/lib/config/store";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "About",
  "Bronxville Natural Market is a neighborhood shop for vitamins and natural supplements at 86 Pondfield Rd.",
  "/about",
);

/**
 * About page. Body content is owner-editable (managed via store settings in a
 * later phase). We do NOT fabricate a history — the copy below is a neutral,
 * clearly-editable shell.
 */
export default function AboutPage() {
  const store = DEFAULT_STORE_CONFIG;
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-[color:var(--brand-ink)]">
          About {store.name}
        </h1>
        <p className="mt-6 text-[color:var(--muted)]">
          {store.name} is a neighborhood natural market offering vitamins,
          supplements, and wellness products with store pickup and local
          delivery.
        </p>
        <p className="mt-4 text-[color:var(--muted)]">
          Visit us at {formatAddress(store.address)}.
        </p>
        {store.contact.phoneDisplay && (
          <p className="mt-4 text-[color:var(--muted)]">
            Phone:{" "}
            <a className="text-[color:var(--brand-green-strong)] hover:underline" href={`tel:${store.contact.phone}`}>
              {store.contact.phoneDisplay}
            </a>
          </p>
        )}
        {store.contact.email && (
          <p className="mt-2 text-[color:var(--muted)]">
            Email:{" "}
            <a className="text-[color:var(--brand-green-strong)] hover:underline" href={`mailto:${store.contact.email}`}>
              {store.contact.email}
            </a>
          </p>
        )}
        <p className="mt-4 text-[color:var(--muted)]">{formatHours(store.hours)}</p>
      </div>
    </Container>
  );
}
