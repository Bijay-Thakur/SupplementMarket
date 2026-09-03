import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";

/**
 * Centralized feature flags. Import these instead of reading env directly in
 * components so the on/off logic stays in one auditable place.
 */
export const features = {
  /** Real customer auth (Supabase). Off until AUTH_PROVIDER=supabase. */
  customerAuth: publicEnv.customerAuthEnabled,
  /** Demo authentication UX. Not a real account. */
  mockAuth: publicEnv.mockAuthEnabled,
  /**
   * Development-only customer/admin role chooser. THIS IS NOT AUTHORIZATION.
   * Admin APIs verify a signed mock cookie or a Supabase role independently.
   */
  demoRoleSelector: publicEnv.demoRoleSelectorEnabled,
  /** Public Stripe flag. Server still requires PAYMENT_PROVIDER. */
  stripeEnabled: publicEnv.stripeEnabled,
  /** Whether a real Supabase backend is wired up (vs. placeholder/disabled). */
  supabaseConfigured: supabasePublicConfigured,
} as const;
