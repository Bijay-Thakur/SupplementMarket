import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import type { Database } from "@/db/types";
import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";
import {
  applyAuthCookies,
  supabaseSsrCookieOptions,
  type PendingAuthCookie,
} from "@/lib/supabase/cookies";
import { NextResponse } from "next/server";

/**
 * SSR client that records every cookie write. Apply `pending` onto the final
 * NextResponse after authentication finishes so the browser receives them on
 * the same redirect.
 */
export function createCookieRecordingClient(request: NextRequest) {
  const pending: PendingAuthCookie[] = [];
  if (!supabasePublicConfigured) return { supabase: null, pending };
  const supabase = createServerClient<Database>(publicEnv.supabaseUrl!, publicEnv.supabasePublishableKey!, {
    cookieOptions: supabaseSsrCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options: options as Record<string, unknown> | undefined });
        });
      },
    },
  });
  return { supabase, pending };
}

export function jsonWithAuthCookies(data: unknown, pending: PendingAuthCookie[], status = 200) {
  const response = NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
  return applyAuthCookies(response, pending);
}
