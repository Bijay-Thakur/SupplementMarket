/**
 * In-memory mock identity store. Session-only. Never stores passwords.
 */
import type { AuthUser, CustomerAddress } from "./types";
import { DEMO_ADMIN_ID, DEMO_CUSTOMER_ID } from "./mock-session";

type MockProfile = AuthUser & { addresses: CustomerAddress[] };

type Box = {
  users: Map<string, MockProfile>;
  byEmail: Map<string, string>;
  byUsername: Map<string, string>;
};

function seed(): Box {
  const customer: MockProfile = {
    id: DEMO_CUSTOMER_ID,
    email: "demo.customer@bronxvillenatural.demo",
    emailVerified: true,
    username: "demo_customer",
    displayName: "Demo Customer",
    firstName: "Demo",
    lastName: "Customer",
    avatarUrl: null,
    phone: null,
    profileCompleted: true,
    role: "customer",
    provider: "mock",
    isDemo: true,
    addresses: [],
  };
  const admin: MockProfile = {
    id: DEMO_ADMIN_ID,
    email: "demo.admin@bronxvillenatural.demo",
    emailVerified: true,
    username: "demo_admin",
    displayName: "Demo Administrator",
    firstName: "Demo",
    lastName: "Admin",
    avatarUrl: null,
    phone: null,
    profileCompleted: true,
    role: "admin",
    provider: "mock",
    isDemo: true,
    addresses: [],
  };
  const users = new Map<string, MockProfile>([
    [customer.id, customer],
    [admin.id, admin],
  ]);
  return {
    users,
    byEmail: new Map([
      [customer.email, customer.id],
      [admin.email, admin.id],
    ]),
    byUsername: new Map([
      [customer.username.toLowerCase(), customer.id],
      [admin.username.toLowerCase(), admin.id],
    ]),
  };
}

function box(): Box {
  const g = globalThis as typeof globalThis & { __bnmMockAuth?: Box };
  if (!g.__bnmMockAuth) g.__bnmMockAuth = seed();
  return g.__bnmMockAuth;
}

export function resetMockAuthStore() {
  const g = globalThis as typeof globalThis & { __bnmMockAuth?: Box };
  g.__bnmMockAuth = seed();
}

export function getMockProfile(id: string): MockProfile | undefined {
  return box().users.get(id);
}

export function getMockProfileByEmail(email: string): MockProfile | undefined {
  const id = box().byEmail.get(email.trim().toLowerCase());
  return id ? box().users.get(id) : undefined;
}

export function usernameTaken(username: string, excludeId?: string): boolean {
  const id = box().byUsername.get(username.trim().toLowerCase());
  return Boolean(id && id !== excludeId);
}

export function uniqueUsername(base: string): string {
  const cleaned = base.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 24) || "shopper";
  let candidate = cleaned;
  let n = 2;
  while (usernameTaken(candidate)) {
    candidate = `${cleaned}${n}`;
    n += 1;
  }
  return candidate;
}

export function putMockProfile(user: AuthUser): MockProfile {
  const store = box();
  const existing = store.users.get(user.id);
  const profile: MockProfile = {
    ...user,
    addresses: existing?.addresses ?? [],
  };
  store.users.set(user.id, profile);
  store.byEmail.set(user.email.toLowerCase(), user.id);
  store.byUsername.set(user.username.toLowerCase(), user.id);
  return profile;
}

export function listAddresses(userId: string): CustomerAddress[] {
  return box().users.get(userId)?.addresses ?? [];
}

export function saveAddress(userId: string, address: CustomerAddress): CustomerAddress {
  const user = box().users.get(userId);
  if (!user) throw new Error("User not found");
  if (address.isDefault) {
    user.addresses = user.addresses.map((a) => ({ ...a, isDefault: false }));
  }
  const idx = user.addresses.findIndex((a) => a.id === address.id);
  if (idx >= 0) user.addresses[idx] = address;
  else user.addresses.push(address);
  return address;
}

export function deleteAddress(userId: string, id: string) {
  const user = box().users.get(userId);
  if (!user) return;
  user.addresses = user.addresses.filter((a) => a.id !== id);
}
