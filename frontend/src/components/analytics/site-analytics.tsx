"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";
import { publicEnv } from "@/lib/env/public";
import {
  COOKIE_CONSENT_EVENT,
  readCookieConsent,
} from "@/lib/consent/cookie-consent";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
}

/**
 * Loads Google Analytics only after the visitor allows analytics cookies
 * and NEXT_PUBLIC_GA_MEASUREMENT_ID is set. No script is injected otherwise.
 */
export function SiteAnalytics() {
  const measurementId = publicEnv.gaMeasurementId;
  const allowed = useSyncExternalStore(
    subscribe,
    () => readCookieConsent() === "all",
    () => false,
  );

  if (!measurementId || !allowed) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}
