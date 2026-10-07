/** Browser preference only. It never grants access or replaces authentication. */
export const COOKIE_CONSENT_KEY = "bronxville-cookie-consent-v1";
export const COOKIE_CONSENT_EVENT = "bronxville-cookie-consent";

export type CookieConsent = "all" | "essential";

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "all" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(value: CookieConsent) {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}
