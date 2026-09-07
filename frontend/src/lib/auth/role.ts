import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import type { AppRole } from "./types";

function asAppRole(value: unknown): AppRole | null {
  return value === "admin" || value === "customer" ? value : null;
}

export async function lookupAppRole(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ role: AppRole; missing: boolean }> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  const scoped = asAppRole(data?.role);
  if (scoped) return { role: scoped, missing: false };

  if (error) {
    // Keep the client response generic, but leave enough information in the
    // server log to distinguish a missing migration/RLS problem from a user
    // who simply has no assigned role. Never log the token or user identity.
    console.error("Supabase role lookup failed", {
      code: error.code,
      message: error.message,
    });
  }

  try {
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data: row, error: adminError } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      const elevated = asAppRole(row?.role);
      if (elevated) return { role: elevated, missing: false };
      if (adminError) {
        console.error("Supabase service-role lookup failed", {
          code: adminError.code,
          message: adminError.message,
        });
      }
    }
  } catch {
    /* Service role is optional; the user-scoped read is the primary path. */
  }

  return { role: "customer", missing: true };
}
