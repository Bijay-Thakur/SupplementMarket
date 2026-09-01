import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";

/**
 * Centralized feature flags. Import these instead of reading env directly in
 * components so the on/off logic stays in one auditable place.
 */
export const features = {
  /** Customer-facing auth (Google sign-in, account pages). Off by default. */
  customerAuth: publicEnv.customerAuthEnabled,
  /**
   * Development-only customer/admin role chooser. THIS IS NOT AUTHENTICATION
   * and provides no security. Remove before deployment; replace with Supabase
   * Auth + server-verified admin authorization.
   */
  demoRoleSelector: publicEnv.demoRoleSelectorEnabled,
  /** Whether a real Supabase backend is wired up (vs. placeholder/disabled). */
  supabaseConfigured: supabasePublicConfigured,
} as const;
