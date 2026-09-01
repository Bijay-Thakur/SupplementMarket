"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";

let cached: SupabaseClient<Database> | null = null;

/**
 * Browser Supabase client (anon key, RLS-enforced).
 * Returns null when Supabase is not configured so callers degrade gracefully
 * instead of crashing during the placeholder/disabled phase.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!supabasePublicConfigured) return null;
  if (cached) return cached;
  cached = createBrowserClient<Database>(
    publicEnv.supabaseUrl!,
    publicEnv.supabaseAnonKey!,
  );
  return cached;
}
