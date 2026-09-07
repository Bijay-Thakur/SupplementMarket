import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";
import { applyAuthCookies, supabaseSsrCookieOptions, type PendingAuthCookie } from "@/lib/supabase/cookies";

/**
 * Refresh the Supabase Auth session in the Next.js 16 proxy and copy
 * updated cookies onto both the request (for downstream Server Components)
 * and the response (for the browser).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabasePublicConfigured) {
    return { response, userId: null as string | null };
  }

  const pending: PendingAuthCookie[] = [];
  const supabase = createServerClient(publicEnv.supabaseUrl!, publicEnv.supabasePublishableKey!, {
    cookieOptions: supabaseSsrCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options: options as Record<string, unknown> | undefined });
        });
        response = NextResponse.next({ request });
        applyAuthCookies(response, pending);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (userId) return { response, userId };
  const { data: userData } = await supabase.auth.getUser();
  return { response, userId: userData.user?.id ?? null };
}
