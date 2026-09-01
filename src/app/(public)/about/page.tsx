import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { DEFAULT_STORE_CONFIG, formatAddress } from "@/lib/config/store";

export const metadata: Metadata = { title: "About" };

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
      </div>
    </Container>
  );
}
