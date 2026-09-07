import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";

/**
 * Centralized feature flags. Import these instead of reading env directly in
 * components so the on/off logic stays in one auditable place.
 */
export const features = {
  /** Real customer/admin auth through Supabase. */
  customerAuth: supabasePublicConfigured,
  /** Mock authentication has been removed. */
  mockAuth: false,
  /** Legacy interface selector. Unused; authorization is public.user_roles only. */
  demoRoleSelector: false,
  /** Public Stripe flag. Server still requires PAYMENT_PROVIDER. */
  stripeEnabled: publicEnv.stripeEnabled,
  /** Whether a real Supabase backend is wired up (vs. placeholder/disabled). */
  supabaseConfigured: supabasePublicConfigured,
} as const;
