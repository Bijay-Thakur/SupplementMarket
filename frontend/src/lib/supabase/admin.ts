import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import { publicEnv } from "@/lib/env/public";
import { serverEnv, supabaseServiceConfigured } from "@/lib/env/server";

let cached: SupabaseClient<Database> | null = null;

/**
 * Service-role Supabase client. BYPASSES RLS — use only in trusted server code
 * for operations that legitimately need elevated access (e.g. webhook order
 * processing, admin bootstrap). Never import this into a client component.
 * Returns null when the service role is not configured.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  if (!supabaseServiceConfigured) return null;
  if (cached) return cached;
  cached = createClient<Database>(
    publicEnv.supabaseUrl!,
    serverEnv.supabaseServiceRoleKey!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return cached;
}
