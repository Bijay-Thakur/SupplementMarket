import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import { safeNextPath } from "@/lib/auth/schemas";
import {
  ADMIN_FORBIDDEN_MESSAGE,
  AUTH_GENERIC_ERROR,
  UNCONFIRMED_EMAIL_MESSAGE,
} from "@/lib/auth/types";
import { lookupAppRole } from "@/lib/auth/role";

export type SignInPortal = "customer" | "admin";

function adminDestination(next?: string | null) {
  const dest = safeNextPath(next, "/admin");
  if (!dest.startsWith("/admin") || dest.startsWith("/admin/login")) return "/admin";
  return dest;
}

async function verifiedUserId(supabase: SupabaseClient<Database>, fallbackId: string | undefined) {
  const auth = supabase.auth as {
    getClaims?: () => Promise<{ data: { claims?: { sub?: string } } | null; error: { message?: string } | null }>;
  };
  if (typeof auth.getClaims === "function") {
    const { data, error } = await auth.getClaims();
    if (!error && data?.claims?.sub) return data.claims.sub;
  }
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? fallbackId ?? null;
}

export async function resolvePasswordSignIn(input: {
  supabase: SupabaseClient<Database>;
  email: string;
  password: string;
  portal: SignInPortal;
  next?: string | null;
}): Promise<{ error: string } | { redirectTo: string; userId: string; role: "customer" | "admin" }> {
  const { data, error } = await input.supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.user) {
    const text = (error?.message || "").toLowerCase();
    if (text.includes("email not confirmed") || text.includes("email_not_confirmed")) {
      return { error: UNCONFIRMED_EMAIL_MESSAGE };
    }
    if (error?.message) console.error("Supabase sign-in failed:", error.message);
    return { error: AUTH_GENERIC_ERROR };
  }

  const userId = await verifiedUserId(input.supabase, data.user.id);
  if (!userId || userId !== data.user.id) {
    await input.supabase.auth.signOut();
    return { error: AUTH_GENERIC_ERROR };
  }

  const { role } = await lookupAppRole(input.supabase, userId);

  if (input.portal === "admin") {
    if (role !== "admin") {
      await input.supabase.auth.signOut();
      return { error: ADMIN_FORBIDDEN_MESSAGE };
    }
    return { redirectTo: adminDestination(input.next), userId, role };
  }

  return {
    redirectTo: role === "admin" ? adminDestination(input.next) : safeNextPath(input.next, "/account"),
    userId,
    role,
  };
}
