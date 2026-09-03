/**
 * Store configuration.
 *
 * Contact details below are owner-provided. In production they can still be
 * overridden by `store_settings` from the admin portal.
 */
export type StoreContact = {
  /** E.164 phone string, or null when not configured. */
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

export type StoreHours = {
  weekdays: string;
  sunday: string;
};

export type StoreConfig = {
  name: string;
  legalName: string;
  address: StoreAddress;
  contact: StoreContact;
  hours: StoreHours;
  timezone: string;
  currency: "USD";
};

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  name: "Bronxville Natural Market",
  legalName: "Bronxville Natural Market",
  address: {
    line1: "86 Pondfield Rd",
    city: "Bronxville",
    state: "NY",
    zip: "10708",
    verified: true,
  },
  contact: {
    phone: "+19147793552",
    phoneDisplay: "+1 (914) 779-3552",
    phoneIsPlaceholder: false,
    email: "bronxvillenatural@gmail.com",
  },
  hours: {
    weekdays: "Monday–Saturday, 9 AM–7 PM",
    sunday: "Sunday, 10 AM–6 PM",
  },
  timezone: "America/New_York",
  currency: "USD",
};

/** Formats the address as a single line for display / metadata. */
export function formatAddress(a: StoreAddress): string {
  return `${a.line1}, ${a.city}, ${a.state} ${a.zip}`;
}

/** Formats store hours as a single note. */
export function formatHours(h: StoreHours = DEFAULT_STORE_CONFIG.hours): string {
  return `${h.weekdays}. ${h.sunday}.`;
}
