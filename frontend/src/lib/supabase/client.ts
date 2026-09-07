"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";

let cached: SupabaseClient<Database> | null = null;

/**
 * Browser Supabase client (publishable key, RLS-enforced).
 * Never receives SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY.
 */
export function createClient(): SupabaseClient<Database> | null {
  if (!supabasePublicConfigured) return null;
  if (cached) return cached;
  cached = createBrowserClient<Database>(publicEnv.supabaseUrl!, publicEnv.supabasePublishableKey!);
  return cached;
}

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  return createClient();
}
