import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  HeartHandshake,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { PhoneCta } from "@/components/layout/phone-cta";
import { DEFAULT_STORE_CONFIG, formatAddress } from "@/lib/config/store";
import { HomeMerchandising } from "@/components/home/home-merchandising";
import { StoreHoursCard } from "@/components/home/store-hours-card";

const WELLNESS_PATHS = [
  {
    title: "Everyday essentials",
    copy: "Foundational vitamins and minerals for your daily routine.",
    href: "/categories/vitamins",
    accent: "from-[#eef7e8] to-[#f8fbf5]",
  },
  {
    title: "Calm, sleep & balance",
    copy: "Thoughtful support for slower evenings and steadier days.",
    href: "/categories/stress-and-anxiety",
    accent: "from-[#fff0f5] to-[#fff9fb]",
  },
  {
    title: "Herbal favorites",
    copy: "Time-honored botanicals from brands you know and trust.",
    href: "/categories/herbs",
    accent: "from-[#f5f0dd] to-[#fffdf7]",
  },
  {
    title: "Digestive wellness",
    copy: "Probiotics, enzymes and fiber for everyday gut support.",
    href: "/categories/probiotics",
    accent: "from-[#eef5f3] to-[#f9fcfb]",
  },
] as const;

const HERO_PRODUCTS = [
  {
    src: "/media/products/bluebonnet/optimized/bluebonnet-albion-buffered-chelated-magnesium-60-count-60-front.webp",
    alt: "Bluebonnet magnesium supplement",
    className: "left-[4%] top-[25%] h-48 w-36 -rotate-6 sm:left-[9%] sm:h-56 sm:w-40",
  },
  {
    src: "/media/products/gaia-herbs/optimized/gaia-herbs-ashwagandha-root-front.webp",
    alt: "Gaia Herbs ashwagandha supplement",
    className: "left-1/2 top-[9%] z-10 h-64 w-44 -translate-x-1/2 sm:h-72 sm:w-52",
  },
  {
    src: "/media/products/megafood/optimized/megafood-magnesium-300-mg-capsules-60-day-120ct-capsule-front.webp",
    alt: "MegaFood magnesium supplement",
    className: "right-[3%] top-[27%] h-48 w-36 rotate-6 sm:right-[8%] sm:h-56 sm:w-40",
  },
] as const;

/** Approved storefront homepage. Used by the entry route after guest/customer access. */
export function StorefrontHome() {
  const store = DEFAULT_STORE_CONFIG;

  return (
    <>
      <section className="relative overflow-hidden border-b border-[color:var(--border)] bg-[color:var(--brand-cream)]">
        <div aria-hidden="true" className="absolute -left-28 top-10 h-72 w-72 rounded-full bg-[color:var(--brand-gold)]/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[color:var(--brand-magenta)]/10 blur-3xl" />
        <Container className="relative grid items-center gap-8 py-12 lg:max-w-[106rem] lg:grid-cols-[1.02fr_.98fr] lg:gap-10 lg:py-16 xl:gap-12">
          <div className="max-w-2xl lg:justify-self-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-white bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-green-strong)] shadow-sm">
              <Leaf className="h-3.5 w-3.5" aria-hidden /> Local wellness, thoughtfully selected
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] text-[color:var(--brand-ink)] sm:text-5xl xl:text-6xl">
              Feel-good essentials, <span className="text-[color:var(--brand-magenta)]">chosen with care.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[color:var(--muted)] sm:text-lg">
              Explore trusted vitamins, herbs and natural wellness favorites from the brands you love, backed by a neighborhood team that cares.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/products" className={buttonVariants({ size: "lg" })}>
                Shop the catalog <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/sales" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Explore current sales
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[color:var(--muted)]">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[color:var(--brand-green-strong)]" aria-hidden /> Trusted brands</span>
              <span className="inline-flex items-center gap-2"><Store className="h-4 w-4 text-[color:var(--brand-green-strong)]" aria-hidden /> Local pickup</span>
              <PhoneCta />
            </div>
          </div>

          <HeroProductShelf />
        </Container>
      </section>

      <section className="bg-white py-12 sm:py-14">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-magenta)]">Find your starting point</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Wellness for real, everyday life</h2>
            <p className="mt-3 text-[color:var(--muted)]">Browse by what matters to you today, then discover products that fit your routine.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {WELLNESS_PATHS.map((path, index) => (
              <Link
                key={path.title}
                href={path.href}
                className={`group relative overflow-hidden rounded-[--radius-xl] border border-[color:var(--border)] bg-gradient-to-br ${path.accent} p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--brand-green)]/50 hover:shadow-md`}
              >
                <span aria-hidden="true" className="absolute right-4 top-3 font-display text-5xl font-semibold text-[color:var(--brand-green)]/10">0{index + 1}</span>
                <span className="relative block font-display text-lg font-semibold">{path.title}</span>
                <span className="relative mt-2 block text-sm leading-relaxed text-[color:var(--muted)]">{path.copy}</span>
                <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-green-strong)]">
                  Shop now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-[color:var(--border)] bg-[color:var(--brand-cream)]/70 py-10">
        <Container>
          <div className="grid gap-4 md:grid-cols-2">
            <FulfillmentCard
              icon={<Store className="h-6 w-6" aria-hidden />}
              title="Easy store pickup"
              body="Order online and pick up at our Bronxville store. We'll let you know when it's ready."
              href="/shipping-pickup"
            />
            <FulfillmentCard
              icon={<Truck className="h-6 w-6" aria-hidden />}
              title="Local delivery"
              body="Get your wellness favorites delivered within our configured local ZIP codes."
              href="/shipping-pickup"
            />
          </div>
        </Container>
      </section>

      <section className="py-12">
        <HomeMerchandising />
      </section>

      <section className="bg-[color:var(--brand-cream)] py-16">
        <Container className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-green-strong)]"><HeartHandshake className="h-4 w-4" aria-hidden /> Here when you need us</span>
            <h2 className="mt-3 font-display text-3xl font-semibold">Your neighborhood natural market</h2>
            <p className="mt-3 max-w-prose text-[color:var(--muted)]">Visit us in person for a thoughtful selection and friendly, personalized guidance from our team.</p>
            <p className="mt-6 flex items-start gap-2 text-[color:var(--brand-ink)]">
              <MapPin className="mt-0.5 h-5 w-5 text-[color:var(--brand-green-strong)]" aria-hidden />
              <span>{formatAddress(store.address)}</span>
            </p>
            <div className="mt-3"><PhoneCta /></div>
          </div>
          <StoreHoursCard />
        </Container>
      </section>
    </>
  );
}

function HeroProductShelf() {
  return (
    <div className="relative mx-auto w-full max-w-[36rem] lg:mx-0 lg:justify-self-start">
      <div className="relative min-h-[25rem] overflow-hidden rounded-[2rem] border border-white/90 bg-white/75 shadow-[0_24px_70px_rgba(24,48,27,0.13)] backdrop-blur-sm sm:min-h-[29rem]">
        <div aria-hidden="true" className="absolute inset-x-10 bottom-12 h-20 rounded-[50%] bg-[color:var(--brand-green)]/12 blur-2xl" />
        <div className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-[color:var(--brand-ink)] shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-gold)]" aria-hidden /> Shelf favorites
        </div>
        {HERO_PRODUCTS.map((product) => (
          <div key={product.src} className={`absolute ${product.className}`}>
            <Image src={product.src} alt={product.alt} fill sizes="(max-width: 640px) 144px, 208px" className="object-contain drop-shadow-xl" />
          </div>
        ))}
        <div className="absolute inset-x-5 bottom-5 z-20 flex items-center justify-between gap-4 rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
          <span>
            <span className="block font-display font-semibold">Good choices, all in one place</span>
            <span className="mt-0.5 block text-xs text-[color:var(--muted)]">Vitamins · Herbs · Probiotics · More</span>
          </span>
          <Link href="/products" aria-label="Browse all products" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-green)] text-white transition hover:bg-[color:var(--brand-green-strong)]">
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FulfillmentCard({ icon, title, body, href }: { icon: ReactNode; title: string; body: string; href: string }) {
  return (
    <Link href={href} className="group flex gap-4 rounded-[--radius-xl] border border-[color:var(--border)] bg-white p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[color:var(--brand-green)] hover:shadow-md">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-green)]/10 text-[color:var(--brand-green-strong)]">{icon}</span>
      <span>
        <span className="block font-display text-lg font-semibold text-[color:var(--brand-ink)]">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-[color:var(--muted)]">{body}</span>
      </span>
    </Link>
  );
}
