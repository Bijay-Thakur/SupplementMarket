"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/auth/schemas";
import { AUTH_GENERIC_ERROR } from "@/lib/auth/types";
import { resolvePasswordSignIn } from "@/lib/auth/password-sign-in";

export type SignInState = { error: string | null };

export async function signInWithPasswordAction(
  _prev: SignInState | undefined,
  formData: FormData,
): Promise<SignInState> {
  const portal = formData.get("portal") === "admin" ? "admin" : "customer";
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    portal,
    next: String(formData.get("next") ?? ""),
  });
  if (!parsed.success) {
    return { error: AUTH_GENERIC_ERROR };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { error: "Authentication is not configured." };
  }

  const result = await resolvePasswordSignIn({
    supabase,
    email: parsed.data.email,
    password: parsed.data.password,
    portal,
    next: parsed.data.next,
  });
  if ("error" in result) return { error: result.error };
  redirect(result.redirectTo);
}

export async function signOutAction(redirectTo = "/") {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect(redirectTo);
}

export async function signOutToHomeAction() {
  await signOutAction("/");
}

export async function signOutToAdminLoginAction() {
  await signOutAction("/admin/login");
}
