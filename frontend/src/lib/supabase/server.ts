import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";

/**
 * Server Supabase client bound to the request cookies (SSR session handling).
 * RLS is enforced (anon/authenticated role). Returns null when Supabase is not
 * configured. Cookie writes are wrapped in try/catch because Server Components
 * cannot set cookies — that is expected and safe (session refresh happens in
 * middleware / route handlers).
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  if (!supabasePublicConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl!,
    publicEnv.supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — ignore. Session refresh
            // is handled by middleware and route handlers where writes work.
          }
        },
      },
    },
  );
}
