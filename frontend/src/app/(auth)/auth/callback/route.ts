import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { publicEnv, supabasePublicConfigured } from "@/lib/env/public";
import { safeNextPath } from "@/lib/auth/schemas";
import { applyAuthCookies, supabaseSsrCookieOptions, type PendingAuthCookie } from "@/lib/supabase/cookies";
import { requestOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const siteUrl = requestOrigin(request);
  const next = safeNextPath(url.searchParams.get("next"), "/account");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const emailType = url.searchParams.get("type");
  const errorDescription = url.searchParams.get("error_description") || url.searchParams.get("error");

  const hasTokenConfirmation = Boolean(tokenHash && emailType === "email");
  if (errorDescription || (!code && !hasTokenConfirmation)) {
    const dest = new URL("/auth/error", siteUrl);
    dest.searchParams.set("reason", errorDescription ? "expired" : "callback");
    return NextResponse.redirect(dest);
  }

  if (!supabasePublicConfigured) {
    const dest = new URL("/auth/error", siteUrl);
    dest.searchParams.set("reason", "config");
    return NextResponse.redirect(dest);
  }

  const pending: PendingAuthCookie[] = [];

  const supabase = createServerClient(publicEnv.supabaseUrl!, publicEnv.supabasePublishableKey!, {
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

  const { error } = hasTokenConfirmation
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: emailType as EmailOtpType,
      })
    : await supabase.auth.exchangeCodeForSession(code!);
  if (error) {
    console.error("Supabase auth callback failed:", error.message);
    const fail = new URL("/auth/error", siteUrl);
    fail.searchParams.set("reason", "expired");
    return NextResponse.redirect(fail);
  }

  const dest = new URL(next, siteUrl);
  const response = NextResponse.redirect(dest);
  response.headers.set("Cache-Control", "private, no-store");

  return applyAuthCookies(response, pending);
}
