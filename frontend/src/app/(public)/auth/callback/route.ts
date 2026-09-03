import { NextResponse } from "next/server";
import { features } from "@/lib/config/features";
import { publicEnv } from "@/lib/env/public";
import { safeNextPath } from "@/lib/auth/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const dest = new URL(next, publicEnv.siteUrl);
  if (!features.customerAuth) {
    return NextResponse.redirect(new URL("/", publicEnv.siteUrl));
  }
  const code = url.searchParams.get("code");
  const supabase = await getSupabaseServerClient();
  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=callback", publicEnv.siteUrl));
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=callback", publicEnv.siteUrl));
  }
  return NextResponse.redirect(dest);
}
