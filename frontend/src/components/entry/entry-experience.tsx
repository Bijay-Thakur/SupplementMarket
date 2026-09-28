"use client";

import { useCallback, useEffect, useRef, forwardRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import {
  type EntryMode,
  readEntryMode,
  writeEntryMode,
  clearEntryMode,
} from "@/lib/entry-mode";

const WALLPAPER_PRODUCTS = [
  {
    src: "/media/products/bluebonnet/optimized/bluebonnet-buffered-vitamin-c-1000-mg-90-count-90-front.webp",
    className: "-left-8 top-[16%] h-44 w-36 -rotate-6 sm:left-[3%] sm:h-56 sm:w-44 xl:left-[7%] xl:h-64 xl:w-52",
  },
  {
    src: "/media/products/gaia-herbs/optimized/gaia-herbs-ashwagandha-root-front.webp",
    className: "-right-9 top-[13%] h-48 w-40 rotate-6 sm:right-[3%] sm:h-60 sm:w-48 xl:right-[7%] xl:h-72 xl:w-56",
  },
  {
    src: "/media/products/maryruths/optimized/maryruths-liquid-morning-multivitamin-liquid-front.webp",
    className: "bottom-[4%] left-[2%] hidden h-48 w-40 rotate-6 sm:block lg:left-[12%] lg:h-60 lg:w-48",
  },
  {
    src: "/media/products/megafood/optimized/megafood-magnesium-300-mg-capsules-60-day-120ct-capsule-front.webp",
    className: "bottom-[3%] right-[2%] hidden h-48 w-40 -rotate-6 sm:block lg:right-[12%] lg:h-60 lg:w-48",
  },
  {
    src: "/media/products/naturesplus/optimized/naturesplus-vitamin-d3-1000-iu-vitamin-k2-100-mcg-capsules-capsule-front.webp",
    className: "left-[21%] top-[7%] hidden h-36 w-28 rotate-3 lg:block xl:left-[25%] xl:h-44 xl:w-36",
  },
  {
    src: "/media/products/natures-way/optimized/natures-way-alive-women-s-ultra-multivitamin-60-tablets-tablet-60-front.webp",
    className: "right-[21%] top-[7%] hidden h-36 w-28 -rotate-3 lg:block xl:right-[25%] xl:h-44 xl:w-36",
  },
  {
    src: "/media/products/twinlab/optimized/twinlab-twinlab-daily-omega-softgels-for-healthy-heart-joints-softgel-front.webp",
    className: "bottom-[8%] left-[29%] hidden h-36 w-28 -rotate-3 lg:block xl:h-44 xl:w-36",
  },
  {
    src: "/media/products/vital-planet/optimized/vital-planet-vital-flora-advanced-biome-probiotic-30ct-shelf-stable-30-capsules.webp",
    className: "bottom-[8%] right-[29%] hidden h-36 w-28 rotate-3 lg:block xl:h-44 xl:w-36",
  },
] as const;

/**
 * Unauthenticated `/` gate. sessionStorage (and a UI-only cookie mirror) remember
 * the choice for this tab. Neither grants a role nor a Supabase session.
 */
export function EntryExperience() {
  const router = useRouter();

  useEffect(() => {
    const stored = readEntryMode();
    if (stored === "guest") {
      writeEntryMode("guest");
      router.refresh();
      return;
    }
    if (stored === "customer") {
      writeEntryMode("customer");
      router.replace("/auth/sign-in");
      return;
    }
    if (stored === "admin") {
      writeEntryMode("admin");
      router.replace("/admin/login");
    }
  }, [router]);

  return <EntryScreen />;
}

function EntryScreen() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  const choose = useCallback(
    (mode: EntryMode) => {
      writeEntryMode(mode);
      if (mode === "guest") router.refresh();
      if (mode === "customer") router.push("/auth/sign-in");
      if (mode === "admin") router.push("/admin/login");
    },
    [router],
  );

  useEffect(() => {
    firstButtonRef.current?.focus();
    const node = dialogRef.current;
    if (!node) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        choose("guest");
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [choose]);

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[color:var(--brand-cream)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.96)_0%,rgba(255,249,241,0.84)_34%,rgba(240,234,220,0.72)_100%)]"
      />
      <SupplementWallpaper />
      <div className="relative z-10 flex justify-center px-4 pt-14 sm:pt-16">
        <div className="rounded-full border border-white/80 bg-white/70 px-6 py-3 shadow-[0_12px_38px_rgba(24,48,27,0.09)] backdrop-blur-md sm:px-8 sm:py-4">
          <Logo
            markSize={68}
            className="gap-4 [&>span>span:first-child]:text-2xl [&>span>span:last-child]:text-xs sm:[&>span>span:first-child]:text-3xl sm:[&>span>span:last-child]:text-sm"
          />
        </div>
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-8 sm:pb-16 sm:pt-10">
        <div
          ref={dialogRef}
          className="relative w-full max-w-[29rem] overflow-hidden rounded-[1.75rem] border border-white/90 bg-white/90 p-6 shadow-[0_26px_70px_rgba(24,48,27,0.16)] outline-none backdrop-blur-xl sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-chooser-title"
          aria-describedby="entry-chooser-copy"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[color:var(--brand-green)] via-[color:var(--brand-gold)] to-[color:var(--brand-magenta)]"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-green-strong)]">
            Welcome
          </p>
          <h1
            id="entry-chooser-title"
            className="mt-2 font-display text-[1.7rem] font-semibold leading-tight text-[color:var(--brand-ink)] sm:text-3xl"
          >
            How would you like to continue?
          </h1>
          <p id="entry-chooser-copy" className="mt-3 text-sm text-[color:var(--muted)]">
            Choose how you want to use Bronxville Natural Market. This choice is
            stored only in this browser tab and does not sign you in.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <ChoiceButton
              ref={firstButtonRef}
              title="Continue as Guest"
              description="Browse products and store information without signing in."
              variant="magenta"
              onClick={() => choose("guest")}
            />
            <ChoiceButton
              title="Continue as Customer"
              description="Sign in or create an account to manage your profile and future orders."
              variant="green"
              onClick={() => choose("customer")}
            />
            <ChoiceButton
              title="Continue as Admin"
              description="Access catalog and store-management tools."
              variant="outline"
              onClick={() => choose("admin")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SupplementWallpaper() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {WALLPAPER_PRODUCTS.map((product) => (
        <div key={product.src} className={`absolute ${product.className}`}>
          <Image
            src={product.src}
            alt=""
            fill
            sizes="(max-width: 640px) 144px, (max-width: 1280px) 192px, 224px"
            loading="lazy"
            className="object-contain opacity-[0.2] mix-blend-multiply saturate-[0.9]"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,249,241,0.2),rgba(255,255,255,0.38)_50%,rgba(255,249,241,0.2))]" />
    </div>
  );
}

const ChoiceButton = forwardRef<
  HTMLButtonElement,
  {
    title: string;
    description: string;
    variant: "magenta" | "green" | "outline";
    onClick: () => void;
  }
>(function ChoiceButton({ title, description, variant, onClick }, ref) {
  const styles =
    variant === "magenta"
      ? "border-[color:var(--brand-magenta)] bg-[color:var(--brand-magenta)] text-white shadow-[0_8px_22px_rgba(178,30,82,0.18)] hover:border-[color:var(--brand-magenta-strong)] hover:bg-[color:var(--brand-magenta-strong)]"
      : variant === "green"
        ? "border-[color:var(--brand-green)] bg-[color:var(--brand-green)] text-white shadow-[0_8px_22px_rgba(82,132,63,0.16)] hover:border-[color:var(--brand-green-strong)] hover:bg-[color:var(--brand-green-strong)]"
        : "border-[color:var(--border)] bg-white/80 text-[color:var(--brand-ink)] shadow-sm hover:border-[color:var(--brand-green)] hover:bg-[color:var(--brand-cream)]";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-gold)] ${styles}`}
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className={`mt-1 block text-xs leading-relaxed ${variant === "outline" ? "text-[color:var(--muted)]" : "text-white/90"}`}>
          {description}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-lg transition-transform group-hover:translate-x-1">
        →
      </span>
    </button>
  );
});

export function SwitchExperienceButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={
        className ??
        "rounded-[--radius] px-2 py-1 text-xs font-medium text-[color:var(--muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      }
      onClick={() => {
        clearEntryMode();
        if (window.location.pathname === "/") router.refresh();
        else router.push("/");
      }}
    >
      Switch experience
    </button>
  );
}
