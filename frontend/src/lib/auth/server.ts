import "server-only";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { AUTH_GENERIC_ERROR, MOCK_SESSION_COOKIE, type AuthUser } from "./types";
import { userFromMockPayload, verifyMockSession } from "./mock-session";
import { getMockProfile } from "./mock-store";

export async function getUserFromCookieStore(): Promise<AuthUser | null> {
  if (serverEnv.authProvider === "mock") {
    const jar = await cookies();
    const token = jar.get(MOCK_SESSION_COOKIE)?.value;
    const payload = verifyMockSession(token, serverEnv.mockAuthSecret ?? "");
    if (!payload) return null;
    const profile = getMockProfile(payload.sub);
    return userFromMockPayload(payload, profile ?? undefined);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const row = profile as Record<string, string | boolean | null> | null;
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    username: String(row?.username ?? user.email?.split("@")[0] ?? "user"),
    displayName: String(row?.display_name ?? user.user_metadata?.full_name ?? ""),
    firstName: String(row?.first_name ?? ""),
    lastName: String(row?.last_name ?? ""),
    avatarUrl: (row?.avatar_url as string | null) ?? null,
    phone: (row?.phone as string | null) ?? null,
    profileCompleted: Boolean(row?.profile_completed),
    role: roleRow && (roleRow as { role?: string }).role === "admin" ? "admin" : "customer",
    provider: "supabase",
    isDemo: false,
  };
}

export async function getUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  if (serverEnv.authProvider === "mock") {
    const token = req.cookies.get(MOCK_SESSION_COOKIE)?.value;
    const payload = verifyMockSession(token, serverEnv.mockAuthSecret ?? "");
    if (!payload) return null;
    const profile = getMockProfile(payload.sub);
    return userFromMockPayload(payload, profile ?? undefined);
  }
  return getUserFromCookieStore();
}

export async function requireUser(req?: NextRequest): Promise<AuthUser> {
  const user = req ? await getUserFromRequest(req) : await getUserFromCookieStore();
  if (!user) throw new ApiHttpError(401, "Sign in is required.", "unauthorized");
  return user;
}

export async function requireAdmin(req?: NextRequest): Promise<AuthUser> {
  const user = await requireUser(req);
  if (user.role !== "admin") {
    throw new ApiHttpError(403, "Administrator access is required.", "forbidden");
  }
  return user;
}

export { AUTH_GENERIC_ERROR };
