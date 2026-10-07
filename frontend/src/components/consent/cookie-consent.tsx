"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  COOKIE_CONSENT_EVENT,
  type CookieConsent,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/consent/cookie-consent";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
}

export function CookieConsentBanner() {
  const choice = useSyncExternalStore<CookieConsent | null>(
    subscribe,
    readCookieConsent,
    () => "essential",
  );

  if (choice) return null;

  return (
    <div
      role="region"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-copy"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-4 shadow-xl sm:inset-x-4 sm:p-5"
    >
      <h2 id="cookie-consent-title" className="font-display text-lg font-semibold text-[color:var(--brand-ink)]">
        Cookies on this site
      </h2>
      <p id="cookie-consent-copy" className="mt-2 text-sm leading-relaxed text-[color:var(--brand-ink)]">
        Essential cookies keep you signed in and remember how you chose to browse. Optional analytics cookies load only if you allow them.{" "}
        <Link href="/privacy" className="font-medium text-[color:var(--brand-magenta-strong)] underline">
          Privacy Policy
        </Link>
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="h-11 rounded-[--radius] border border-[color:var(--border)] px-4 text-sm font-medium text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]"
          onClick={() => writeCookieConsent("essential")}
        >
          Essential only
        </button>
        <button
          type="button"
          className="h-11 rounded-[--radius] bg-[color:var(--brand-magenta-strong)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--brand-magenta)]"
          onClick={() => writeCookieConsent("all")}
        >
          Allow analytics
        </button>
      </div>
    </div>
  );
}
