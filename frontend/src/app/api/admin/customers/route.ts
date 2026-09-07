import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ApiHttpError } from "@/lib/demo-store/engine";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = await getSupabaseServerClient();
    if (!supabase) return json({ error: "config", detail: "Supabase is not configured." }, 503);

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "customer");
    if (roleError) return json({ error: "error", detail: "Could not load customers." }, 400);

    const ids = (roles ?? []).map((row) => row.user_id);
    if (!ids.length) return json({ items: [] });

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, phone, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) return json({ error: "error", detail: "Could not load customers." }, 400);

    return json({ items: profiles ?? [] });
  } catch (err) {
    if (err instanceof ApiHttpError) {
      return json(err.body, err.status);
    }
    return json({ error: "error", detail: "Could not load customers." }, 400);
  }
}
