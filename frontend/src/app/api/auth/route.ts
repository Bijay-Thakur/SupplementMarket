import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCookieRecordingClient, jsonWithAuthCookies } from "@/lib/supabase/route";
import { publicEnv } from "@/lib/env/public";
import {
  ADMIN_FORBIDDEN_MESSAGE,
  AUTH_GENERIC_ERROR,
  DUPLICATE_USERNAME_MESSAGE,
  EMAIL_DELIVERY_UNAVAILABLE_MESSAGE,
  EMAIL_RATE_LIMIT_MESSAGE,
  EXPIRED_LINK_MESSAGE,
  NETWORK_FAILURE_MESSAGE,
  PASSWORD_RESET_GENERIC,
  SIGNUP_GENERIC_ERROR,
  UNCONFIRMED_EMAIL_MESSAGE,
} from "@/lib/auth/types";
import { emailOnlySchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/auth/schemas";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { resolvePasswordSignIn } from "@/lib/auth/password-sign-in";
import { AuthHttpError } from "@/lib/auth/contract";
import type { PendingAuthCookie } from "@/lib/supabase/cookies";
import { assertSameOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function reply(pending: PendingAuthCookie[], data: unknown, status = 200) {
  return jsonWithAuthCookies(data, pending, status);
}

function fieldError(
  pending: PendingAuthCookie[],
  error: { issues: Array<{ path: PropertyKey[]; message: string }> },
) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fields[key]) fields[key] = issue.message;
  }
  return reply(pending, { error: "validation", detail: "Please correct the highlighted fields.", fields }, 400);
}

function mapAuthError(message: string | undefined, fallback = AUTH_GENERIC_ERROR) {
  const text = (message || "").toLowerCase();
  if (text.includes("rate limit")) {
    return EMAIL_RATE_LIMIT_MESSAGE;
  }
  if (
    text.includes("email address not authorized") ||
    text.includes("email delivery") ||
    text.includes("sending confirmation email") ||
    text.includes("smtp")
  ) {
    return EMAIL_DELIVERY_UNAVAILABLE_MESSAGE;
  }
  if (text.includes("email not confirmed") || text.includes("email_not_confirmed")) {
    return UNCONFIRMED_EMAIL_MESSAGE;
  }
  if (text.includes("expired") || text.includes("otp") || text.includes("reuse")) {
    return EXPIRED_LINK_MESSAGE;
  }
  if (text.includes("already registered") || text.includes("user already")) {
    return AUTH_GENERIC_ERROR;
  }
  if (text.includes("weak") || text.includes("password")) {
    return message && message.length < 160 ? message : "Choose a stronger password.";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return NETWORK_FAILURE_MESSAGE;
  }
  return fallback;
}

async function usernameTaken(username: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  // PostgreSQL ILIKE treats underscores as wildcards. Escape them so a
  // username such as "jane_doe" is checked as an exact case-insensitive value.
  const exactPattern = username.replaceAll("_", "\\_");
  const { data, error } = await admin.from("profiles").select("id").ilike("username", exactPattern).maybeSingle();
  if (error) throw new Error("Username availability check failed.");
  return Boolean(data);
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "forbidden", detail: "Invalid request origin." }, { status: 403 });
  }
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "sign-in";
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { supabase, pending } = createCookieRecordingClient(req);

  try {
    if (!supabase) {
      return reply(pending, { error: "config", detail: "Supabase is not configured." }, 503);
    }

    if (action === "sign-out") {
      await supabase.auth.signOut();
      return reply(pending, { ok: true });
    }

    if (action === "forgot-password") {
      const parsed = emailOnlySchema.safeParse(body);
      if (parsed.success) {
        await supabase.auth.resetPasswordForEmail(parsed.data.email, {
          redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
        });
      }
      return reply(pending, { message: PASSWORD_RESET_GENERIC });
    }

    if (action === "resend-confirmation") {
      const parsed = emailOnlySchema.safeParse(body);
      if (parsed.success) {
        await supabase.auth.resend({
          type: "signup",
          email: parsed.data.email,
          options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
        });
      }
      return reply(pending, {
        message: "If that address still needs confirmation, another email is on the way.",
      });
    }

    if (action === "sign-up") {
      if ("role" in body) {
        return reply(pending, { error: "validation", detail: "Role cannot be chosen during signup." }, 400);
      }
      const parsed = signUpSchema.safeParse(body);
      if (!parsed.success) return fieldError(pending, parsed.error);
      if (await usernameTaken(parsed.data.username)) {
        return reply(
          pending,
          { error: "validation", detail: DUPLICATE_USERNAME_MESSAGE, fields: { username: DUPLICATE_USERNAME_MESSAGE } },
          400,
        );
      }
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: {
            username: parsed.data.username,
            full_name: parsed.data.fullName,
          },
          emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`,
        },
      });
      if (error) {
        console.error("Supabase sign-up failed:", error.message);
        const mapped = mapAuthError(error.message, SIGNUP_GENERIC_ERROR);
        if (/redirect/i.test(error.message)) {
          return reply(
            pending,
            {
              error: "auth",
              detail:
                `Supabase rejected the confirmation redirect. Add ${publicEnv.siteUrl}/auth/callback to Authentication → URL Configuration → Redirect URLs.`,
            },
            400,
          );
        }
        if (/database/i.test(error.message)) {
          return reply(
            pending,
            {
              error: "auth",
              detail: "The account could not be created. Try again or contact the store.",
            },
            400,
          );
        }
        const status = /rate limit/i.test(error.message)
          ? 429
          : /sending confirmation email|email delivery|smtp/i.test(error.message)
            ? 502
            : 400;
        return reply(pending, { error: "auth", detail: mapped }, status);
      }
      return reply(pending, {
        ok: true,
        needsVerification: !data.session,
        redirectTo: data.session ? "/account" : "/auth/check-email",
      });
    }

    if (action === "update-password") {
      const parsed = resetPasswordSchema.safeParse(body);
      if (!parsed.success) return fieldError(pending, parsed.error);
      const user = await getAuthenticatedUser();
      if (!user) {
        return reply(pending, { error: "auth", detail: EXPIRED_LINK_MESSAGE }, 401);
      }
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) return reply(pending, { error: "auth", detail: mapAuthError(error.message, EXPIRED_LINK_MESSAGE) }, 400);
      return reply(pending, { ok: true, redirectTo: "/auth/sign-in?reset=1" });
    }

    if (action !== "sign-in") {
      return reply(pending, { error: "not_found", detail: "Unknown authentication action." }, 404);
    }

    const parsed = signInSchema.safeParse(body);
    if (!parsed.success) return fieldError(pending, parsed.error);
    const result = await resolvePasswordSignIn({
      supabase,
      email: parsed.data.email,
      password: parsed.data.password,
      portal: parsed.data.portal === "admin" ? "admin" : "customer",
      next: parsed.data.next,
    });
    if ("error" in result) {
      const status = result.error === ADMIN_FORBIDDEN_MESSAGE ? 403 : 401;
      return reply(
        pending,
        { error: status === 403 ? "forbidden" : "auth", detail: result.error },
        status,
      );
    }
    return reply(pending, { redirectTo: result.redirectTo, role: result.role });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      return reply(pending, { error: "validation", detail: err.message, fields: err.fields }, err.status);
    }
    return reply(pending, { error: "error", detail: AUTH_GENERIC_ERROR }, 400);
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  return json({ user });
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "forbidden", detail: "Invalid request origin." }, { status: 403 });
  }
  const { supabase, pending } = createCookieRecordingClient(req);
  await supabase?.auth.signOut();
  return reply(pending, { ok: true });
}
