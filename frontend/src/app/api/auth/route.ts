import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env/public";
import { AUTH_GENERIC_ERROR, PASSWORD_RESET_GENERIC, safeNextPath, validatePassword, validateSignUp } from "@/lib/auth/types";
import { getUserFromCookieStore } from "@/lib/auth/server";
import { mockForgotPassword, mockGoogle, mockPasswordSignIn, mockSignOut, mockSignUp } from "@/lib/auth/mock-actions";
import { AuthHttpError } from "@/lib/auth/contract";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "sign-in";
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (action === "sign-out") {
      if (serverEnv.authProvider === "mock") return mockSignOut();
      const supabase = await getSupabaseServerClient();
      await supabase?.auth.signOut();
      return NextResponse.json({ ok: true });
    }

    if (action === "forgot-password") {
      if (serverEnv.authProvider === "mock") return mockForgotPassword();
      const supabase = await getSupabaseServerClient();
      if (supabase && typeof body.email === "string") {
        await supabase.auth.resetPasswordForEmail(body.email, {
          redirectTo: `${publicEnv.siteUrl}/auth/reset-password`,
        });
      }
      return NextResponse.json({ message: PASSWORD_RESET_GENERIC });
    }

    if (action === "google") {
      if (serverEnv.authProvider === "mock") {
        const hint = body.roleHint === "admin" ? "admin" : "customer";
        return mockGoogle(hint);
      }
      const supabase = await getSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json({ error: "config", detail: "Supabase is not configured." }, { status: 503 });
      }
      const next = safeNextPath(typeof body.next === "string" ? body.next : null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error || !data.url) {
        return NextResponse.json({ error: "auth", detail: AUTH_GENERIC_ERROR }, { status: 400 });
      }
      return NextResponse.json({ redirectTo: data.url });
    }

    if (action === "demo-continue") {
      if (serverEnv.authProvider !== "mock") {
        return NextResponse.json({ error: "forbidden", detail: "Demo authentication is disabled." }, { status: 403 });
      }
      const role = body.role === "admin" ? "admin" : "customer";
      return mockGoogle(role);
    }

    if (action === "sign-up") {
      if (serverEnv.authProvider === "mock") {
        return mockSignUp({
          username: String(body.username ?? ""),
          firstName: String(body.firstName ?? ""),
          lastName: String(body.lastName ?? ""),
          email: String(body.email ?? ""),
          password: String(body.password ?? ""),
          confirmPassword: String(body.confirmPassword ?? ""),
          acceptedTerms: Boolean(body.acceptedTerms),
        });
      }
      const input = {
        username: String(body.username ?? ""),
        firstName: String(body.firstName ?? ""),
        lastName: String(body.lastName ?? ""),
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        confirmPassword: String(body.confirmPassword ?? ""),
        acceptedTerms: Boolean(body.acceptedTerms),
      };
      const fields = validateSignUp(input);
      if (Object.keys(fields).length) {
        return NextResponse.json({ error: "validation", detail: "Please correct the highlighted fields.", fields }, { status: 400 });
      }
      const supabase = await getSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json({ error: "config", detail: "Supabase is not configured." }, { status: 503 });
      }
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            username: input.username,
            first_name: input.firstName,
            last_name: input.lastName,
            full_name: `${input.firstName} ${input.lastName}`.trim(),
          },
          emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`,
        },
      });
      if (error) {
        return NextResponse.json({ error: "auth", detail: AUTH_GENERIC_ERROR }, { status: 400 });
      }
      return NextResponse.json({ ok: true, needsVerification: true });
    }

    if (action === "update-password") {
      const pwdErr = validatePassword(String(body.password ?? ""));
      if (pwdErr) return NextResponse.json({ error: "validation", detail: pwdErr }, { status: 400 });
      if (serverEnv.authProvider === "mock") {
        return NextResponse.json({ ok: true, message: "Demo password was not stored." });
      }
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase!.auth.updateUser({ password: String(body.password) });
      if (error) return NextResponse.json({ error: "auth", detail: AUTH_GENERIC_ERROR }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    if (serverEnv.authProvider === "mock") return mockPasswordSignIn(email, password);
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "config", detail: "Supabase is not configured." }, { status: 503 });
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: "auth", detail: AUTH_GENERIC_ERROR }, { status: 401 });
    const user = await getUserFromCookieStore();
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      return NextResponse.json({ error: "validation", detail: err.message, fields: err.fields }, { status: err.status });
    }
    return NextResponse.json({ error: "error", detail: AUTH_GENERIC_ERROR }, { status: 400 });
  }
}

export async function GET() {
  const user = await getUserFromCookieStore();
  return NextResponse.json({ user });
}

export async function DELETE() {
  if (serverEnv.authProvider === "mock") return mockSignOut();
  const supabase = await getSupabaseServerClient();
  await supabase?.auth.signOut();
  const jar = await cookies();
  jar.getAll();
  return NextResponse.json({ ok: true });
}
