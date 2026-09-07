import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";
import { supabaseSsrCookieOptions } from "@/lib/supabase/cookies";

/**
 * Server Supabase client bound to request cookies.
 * Cookie writes succeed in Server Actions and Route Handlers. Server Component
 * renders ignore set() and that error is swallowed there only.
 */
export async function createClient(): Promise<SupabaseClient<Database> | null> {
  if (!supabasePublicConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl!, publicEnv.supabasePublishableKey!, {
    cookieOptions: supabaseSsrCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            /* Immutable cookie store during Server Component render. */
          }
        });
      },
    },
  });
}

export async function getSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  return createClient();
}
