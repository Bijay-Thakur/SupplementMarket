import Link from "next/link";
import Image from "next/image";
import { MapPin, Store, Truck, Leaf } from "lucide-react";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { PhoneCta } from "@/components/layout/phone-cta";
import { DEFAULT_STORE_CONFIG, formatAddress } from "@/lib/config/store";
import { HomeMerchandising } from "@/components/home/home-merchandising";
import { StoreHoursCard } from "@/components/home/store-hours-card";

/**
 * Home: hero, pickup/delivery, merchandising from the demonstration catalog.
 */
export default function HomePage() {
  const store = DEFAULT_STORE_CONFIG;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[color:var(--brand-cream)]">
        <Container className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-green-strong)] shadow-sm">
              <Leaf className="h-3.5 w-3.5" aria-hidden /> Local wellness, since your neighborhood needed it
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-[color:var(--brand-ink)] sm:text-5xl">
              Vitamins & natural supplements,{" "}
              <span className="text-[color:var(--brand-magenta)]">
                curated with care
              </span>
              .
            </h1>
            <p className="mt-4 max-w-prose text-lg text-[color:var(--muted)]">
              Discover trusted brands and wellness essentials at Bronxville
              Natural Market. Shop online, then pick up in store or get local
              delivery.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                className={buttonVariants({ size: "lg" })}
              >
                Shop the catalog
              </Link>
              <Link
                href="/sales"
                className="text-sm font-semibold text-[color:var(--brand-magenta)] hover:underline"
              >
                See current sales →
              </Link>
            </div>
            <div className="mt-6">
              <PhoneCta />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-0 -z-10 rounded-full bg-[color:var(--brand-gold)]/15 blur-2xl" />
            <Image
              src="/brand/bronxville-natural-market-logo.png"
              alt="Bronxville Natural Market"
              width={560}
              height={560}
              priority
              className="mx-auto h-auto w-full drop-shadow-sm"
            />
          </div>
        </Container>
      </section>

      {/* Fulfillment explainer */}
      <section className="py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            <FulfillmentCard
              icon={<Store className="h-6 w-6" aria-hidden />}
              title="Store pickup"
              body="Order online and pick up at our Bronxville store. We'll let you know when it's ready."
              href="/shipping-pickup"
            />
            <FulfillmentCard
              icon={<Truck className="h-6 w-6" aria-hidden />}
              title="Local delivery"
              body="We deliver within configured local ZIP codes. Delivery fees and areas are set by the store."
              href="/shipping-pickup"
            />
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <HomeMerchandising />
      </section>

      {/* Local trust section */}
      <section className="bg-[color:var(--brand-cream)] py-16">
        <Container className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold">
              Your neighborhood natural market
            </h2>
            <p className="mt-3 max-w-prose text-[color:var(--muted)]">
              Visit us in person for personalized guidance from our team.
              Store hours and details are managed by the owner and shown here
              once verified.
            </p>
            <p className="mt-6 flex items-start gap-2 text-[color:var(--brand-ink)]">
              <MapPin
                className="mt-0.5 h-5 w-5 text-[color:var(--brand-green-strong)]"
                aria-hidden
              />
              <span>{formatAddress(store.address)}</span>
            </p>
            <div className="mt-3">
              <PhoneCta />
            </div>
          </div>
          <StoreHoursCard />
        </Container>
      </section>
    </>
  );
}

function FulfillmentCard({
  icon,
  title,
  body,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-4 rounded-[--radius-xl] border border-[color:var(--border)] bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-[color:var(--brand-green)]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-green)]/10 text-[color:var(--brand-green-strong)]">
        {icon}
      </span>
      <span>
        <span className="block font-display text-lg font-semibold text-[color:var(--brand-ink)]">
          {title}
        </span>
        <span className="mt-1 block text-sm text-[color:var(--muted)]">
          {body}
        </span>
      </span>
    </Link>
  );
}
