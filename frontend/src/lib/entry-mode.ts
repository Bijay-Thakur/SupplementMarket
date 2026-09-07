/**
 * Browser-only entry preference. Never used as authentication or authorization.
 * Valid values: guest | customer | admin.
 *
 * sessionStorage is the specified client store. A same-named non-HttpOnly
 * cookie is mirrored only so `/` can SSR the gate vs storefront without
 * shipping store chrome behind the dialog. FastAPI and requireAdmin ignore it.
 */
export type EntryMode = "guest" | "customer" | "admin";

export const ENTRY_MODE_STORAGE_KEY = "bronxville-entry-mode-v3";
export const ENTRY_RESET_EVENT = "bronxville-entry-reset";

const LEGACY_KEYS = [
  "bronxville-interface-mode-v2",
  "bnm-demo-role",
  "DEMO_ROLE_STORAGE_KEY",
];

export function parseEntryMode(value: string | null | undefined): EntryMode | null {
  return value === "guest" || value === "customer" || value === "admin" ? value : null;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function writePreferenceCookie(mode: EntryMode | null) {
  if (typeof document === "undefined") return;
  if (mode) {
    document.cookie = `${ENTRY_MODE_STORAGE_KEY}=${mode}; Path=/; SameSite=Lax; Max-Age=86400`;
  } else {
    document.cookie = `${ENTRY_MODE_STORAGE_KEY}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
}

function clearLegacy() {
  if (typeof window === "undefined") return;
  try {
    LEGACY_KEYS.forEach((key) => {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    });
  } catch {
    /* ignore */
  }
}

export function readEntryMode(): EntryMode | null {
  const store = storage();
  if (!store) return null;
  clearLegacy();
  return parseEntryMode(store.getItem(ENTRY_MODE_STORAGE_KEY));
}

export function writeEntryMode(mode: EntryMode) {
  const store = storage();
  if (!store) return;
  store.setItem(ENTRY_MODE_STORAGE_KEY, mode);
  writePreferenceCookie(mode);
}

export function clearEntryMode() {
  const store = storage();
  if (store) store.removeItem(ENTRY_MODE_STORAGE_KEY);
  writePreferenceCookie(null);
  clearLegacy();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENTRY_RESET_EVENT));
  }
}
