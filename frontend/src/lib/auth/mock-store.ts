/**
 * In-memory address book for snapshot-mode checkout only.
 * Never stores passwords or roles. Authentication uses Supabase Auth.
 */
import type { CustomerAddress } from "./types";

type Box = {
  addresses: Map<string, CustomerAddress[]>;
};

function box(): Box {
  const g = globalThis as typeof globalThis & { __bnmAddresses?: Box };
  if (!g.__bnmAddresses) g.__bnmAddresses = { addresses: new Map() };
  return g.__bnmAddresses;
}

export function listAddresses(userId: string): CustomerAddress[] {
  return box().addresses.get(userId) ?? [];
}

export function saveAddress(userId: string, address: CustomerAddress): CustomerAddress {
  const store = box();
  const current = store.addresses.get(userId) ?? [];
  const next = address.isDefault ? current.map((a) => ({ ...a, isDefault: false })) : current.slice();
  const idx = next.findIndex((a) => a.id === address.id);
  if (idx >= 0) next[idx] = address;
  else next.push(address);
  store.addresses.set(userId, next);
  return address;
}

export function deleteAddress(userId: string, id: string) {
  const store = box();
  store.addresses.set(
    userId,
    (store.addresses.get(userId) ?? []).filter((a) => a.id !== id),
  );
}
