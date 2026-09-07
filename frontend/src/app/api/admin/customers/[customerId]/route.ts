import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError } from "@/lib/demo-store/engine";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ customerId: string }> },
) {
  try {
    const adminUser = await requireAdmin(req);
    const { customerId } = await ctx.params;
    if (!UUID.test(customerId)) {
      return json({ error: "validation", detail: "Invalid customer." }, 400);
    }
    const body = (await req.json().catch(() => ({}))) as { confirmation?: string };
    if (body.confirmation !== "CONFIRM") {
      return json({ error: "validation", detail: "Type CONFIRM to remove this customer." }, 400);
    }
    if (customerId === adminUser.id) {
      return json({ error: "validation", detail: "You cannot remove your own account here." }, 400);
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) return json({ error: "config", detail: "Supabase is not configured." }, 503);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", customerId)
      .maybeSingle();
    if (roleRow?.role === "admin") {
      return json({ error: "forbidden", detail: "Administrator accounts cannot be removed here." }, 403);
    }

    const admin = getSupabaseAdminClient();
    if (!admin) return json({ error: "config", detail: "Customer removal is not configured." }, 503);

    const { error } = await admin.auth.admin.deleteUser(customerId);
    if (error) return json({ error: "error", detail: "Could not remove that customer." }, 400);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof ApiHttpError) {
      return json(err.body, err.status);
    }
    return json({ error: "error", detail: "Could not remove that customer." }, 400);
  }
}
