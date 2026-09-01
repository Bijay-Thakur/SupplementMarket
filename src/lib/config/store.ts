/**
 * Store configuration defaults.
 *
 * These are DEVELOPMENT DEFAULTS. In production every mutable value here is
 * overridden by the `store_settings` table (managed from the admin portal in
 * Phase 5). Values marked `isPlaceholder` MUST be replaced with owner-verified
 * data before launch — they are never presented as authoritative fact.
 *
 * The store address below is the real, owner-provided business address and is
 * treated as verified.
 */
export type StoreContact = {
  /** E.164-ish phone string, or null when not yet configured. */
  phone: string | null;
  /** Human display of the phone. */
  phoneDisplay: string | null;
  /** True while using a development placeholder rather than a verified number. */
  phoneIsPlaceholder: boolean;
  email: string | null;
};

export type StoreAddress = {
  line1: string;
  city: string;
  state: string;
  zip: string;
  /** Whether this address is owner-verified (true) vs seed placeholder. */
  verified: boolean;
};

export type StoreConfig = {
  name: string;
  legalName: string;
  address: StoreAddress;
  contact: StoreContact;
  timezone: string;
  currency: "USD";
};

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  name: "Bronxville Natural Market",
  legalName: "Bronxville Natural Market",
  address: {
    line1: "86 Pondfield Road",
    city: "Bronxville",
    state: "NY",
    zip: "10708",
    verified: true,
  },
  contact: {
    // Placeholder until the owner supplies a verified number. The UI must label
    // this clearly and must not present it as the real store line.
    phone: null,
    phoneDisplay: null,
    phoneIsPlaceholder: true,
    email: null,
  },
  timezone: "America/New_York",
  currency: "USD",
};

/** Formats the address as a single line for display / metadata. */
export function formatAddress(a: StoreAddress): string {
  return `${a.line1}, ${a.city}, ${a.state} ${a.zip}`;
}
