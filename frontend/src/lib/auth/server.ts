import "server-only";

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ApiHttpError } from "@/lib/demo-store/engine";
import {
  AUTH_GENERIC_ERROR,
  type AppRole,
  type AuthUser,
  splitFullName,
} from "./types";
import { safeNextPath } from "./schemas";
import { lookupAppRole } from "./role";

type AuthKind = "page" | "api";

async function validatedUserId(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
): Promise<string | null> {
  const auth = supabase.auth as {
    getClaims?: () => Promise<{ data: { claims?: { sub?: string } } | null; error: { message?: string } | null }>;
  };
  if (typeof auth.getClaims === "function") {
    const { data, error } = await auth.getClaims();
    if (!error && data?.claims?.sub) return data.claims.sub;
  }
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function toAuthUser(
  user: User,
  profile: {
    username?: string | null;
    full_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  } | null,
  role: AppRole,
  missingProfile: boolean,
  missingRole: boolean,
): AuthUser {
  const fullName = String(profile?.full_name ?? user.user_metadata?.full_name ?? "").trim();
  const names = splitFullName(fullName);
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    username: String(profile?.username ?? user.user_metadata?.username ?? user.email?.split("@")[0] ?? "user"),
    displayName: fullName,
    fullName,
    firstName: names.firstName,
    lastName: names.lastName,
    avatarUrl: profile?.avatar_url ?? null,
    phone: profile?.phone ?? null,
    profileCompleted: Boolean(profile?.username && fullName),
    role,
    provider: "supabase",
    isDemo: false,
    createdAt: user.created_at ?? null,
    missingProfile,
    missingRole,
  };
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const userId = await validatedUserId(supabase);
  if (!userId) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || user.id !== userId) return null;

  const [{ data: profile }, roleInfo] = await Promise.all([
    supabase.from("profiles").select("username, full_name, phone, avatar_url").eq("id", user.id).maybeSingle(),
    lookupAppRole(supabase, user.id),
  ]);

  return toAuthUser(user, profile, roleInfo.role, !profile, roleInfo.missing);
}

export async function getVerifiedAccessToken(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const userId = await validatedUserId(supabase);
  if (!userId) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getUserFromCookieStore(): Promise<AuthUser | null> {
  return getAuthenticatedUser();
}

export async function getUserFromRequest(req?: NextRequest): Promise<AuthUser | null> {
  void req;
  return getAuthenticatedUser();
}

function unauthenticatedRedirect(next?: string): never {
  const dest = safeNextPath(next, "/account");
  redirect(`/auth/sign-in?next=${encodeURIComponent(dest)}`);
}

export async function requireUser(req?: NextRequest | { kind?: AuthKind; next?: string }): Promise<AuthUser> {
  const kind: AuthKind = req instanceof NextRequest || !req ? (req instanceof NextRequest ? "api" : "page") : req.kind ?? "page";
  const next = req instanceof NextRequest ? undefined : req?.next;
  const user = await getAuthenticatedUser();
  if (!user) {
    if (kind === "page") unauthenticatedRedirect(next);
    throw new ApiHttpError(401, "Sign in is required.", "unauthorized");
  }
  return user;
}

export async function requireAdmin(req?: NextRequest | { kind?: AuthKind; next?: string }): Promise<AuthUser> {
  const kind: AuthKind = req instanceof NextRequest || !req ? (req instanceof NextRequest ? "api" : "page") : req.kind ?? "page";
  const next = req instanceof NextRequest ? "/admin" : req?.next ?? "/admin";
  const user = await getAuthenticatedUser();
  if (!user) {
    if (kind === "page") redirect(`/admin/login?next=${encodeURIComponent(safeNextPath(next, "/admin"))}`);
    throw new ApiHttpError(401, "Sign in is required.", "unauthorized");
  }
  if (user.missingRole || user.role !== "admin") {
    if (kind === "page") redirect("/auth/forbidden");
    throw new ApiHttpError(403, "Administrator access is required.", "forbidden");
  }
  return user;
}

export { AUTH_GENERIC_ERROR };
