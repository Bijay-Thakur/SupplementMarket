import { NextResponse } from "next/server";
import { features } from "@/lib/config/features";
import { publicEnv } from "@/lib/env/public";

/**
 * OAuth callback. The full Supabase code-exchange lands in Phase 6. While
 * customer auth is disabled this simply redirects home so the route is never a
 * dead end.
 */
export async function GET(request: Request) {
  const home = new URL("/", publicEnv.siteUrl);
  if (!features.customerAuth) {
    return NextResponse.redirect(home);
  }
  // Phase 6: exchange `code` for a session via Supabase, then redirect.
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/account";
  return NextResponse.redirect(new URL(next, publicEnv.siteUrl));
}
