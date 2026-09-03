/**
 * Development-only role gate.
 *
 * THIS IS NOT AUTHENTICATION. It stores a browser preference so the local demo
 * can switch between the customer storefront and the admin UI. It provides no
 * security. Before deployment this module and the role-chooser UI must be
 * removed and replaced by Supabase Auth + server-verified admin authorization.
 */
export type DemoRole = "customer" | "admin";

export const DEMO_ROLE_STORAGE_KEY = "bnm-demo-role";

export function readDemoRole(): DemoRole | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(DEMO_ROLE_STORAGE_KEY);
    return v === "customer" || v === "admin" ? v : null;
  } catch {
    return null;
  }
}

export function writeDemoRole(role: DemoRole): void {
  localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
}

export function clearDemoRole(): void {
  localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
}
