import { NextRequest, NextResponse } from "next/server";
import { createCookieRecordingClient } from "@/lib/supabase/route";
import { applyAuthCookies, redirectWithAuthCookies, type PendingAuthCookie } from "@/lib/supabase/cookies";
import { resolvePasswordSignIn } from "@/lib/auth/password-sign-in";
import { signInSchema, safeNextPath } from "@/lib/auth/schemas";
import { assertSameOrigin, requestOrigin } from "@/lib/auth/origin";
import {
  ADMIN_FORBIDDEN_MESSAGE,
  UNCONFIRMED_EMAIL_MESSAGE,
} from "@/lib/auth/types";

export const dynamic = "force-dynamic";

function errorRedirect(
  path: string,
  code: "auth" | "forbidden" | "unconfirmed" | "config",
  baseUrl: string,
  pending: PendingAuthCookie[] = [],
) {
  const dest = new URL(path, baseUrl);
  dest.searchParams.set("error", code);
  const response = NextResponse.redirect(dest, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return applyAuthCookies(response, pending);
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json(
      { error: "forbidden", detail: "Invalid request origin." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const baseUrl = requestOrigin(request);
  const form = await request.formData();
  const portal = form.get("portal") === "admin" ? "admin" : "customer";
  const loginPath = portal === "admin" ? "/admin/login" : "/auth/sign-in";
  const parsed = signInSchema.safeParse({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    portal,
    next: String(form.get("next") ?? ""),
  });
  if (!parsed.success) return errorRedirect(loginPath, "auth", baseUrl);

  const { supabase, pending } = createCookieRecordingClient(request);
  if (!supabase) return errorRedirect(loginPath, "config", baseUrl);

  const result = await resolvePasswordSignIn({
    supabase,
    email: parsed.data.email,
    password: parsed.data.password,
    portal,
    next: parsed.data.next,
  });
  if ("error" in result) {
    if (result.error === UNCONFIRMED_EMAIL_MESSAGE) return errorRedirect(loginPath, "unconfirmed", baseUrl, pending);
    if (result.error === ADMIN_FORBIDDEN_MESSAGE) return errorRedirect(loginPath, "forbidden", baseUrl, pending);
    return errorRedirect(loginPath, "auth", baseUrl, pending);
  }

  return redirectWithAuthCookies(
    safeNextPath(result.redirectTo, portal === "admin" ? "/admin" : "/account"),
    pending,
    baseUrl,
  );
}
