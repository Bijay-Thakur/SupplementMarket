import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { assertSameOrigin } from "@/lib/auth/origin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { requestStatuses } from "@/lib/requests/schema";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (error: unknown) => error instanceof ApiHttpError ? json(error.body, error.status) : json({ detail: "Requests are temporarily unavailable." }, 503);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const client = await getSupabaseServerClient();
    if (!client) return json({ detail: "Requests are temporarily unavailable." }, 503);
    if (req.nextUrl.searchParams.get("summary") === "1") {
      const { count, error } = await client.from("supplement_requests").select("id", { count: "exact", head: true }).eq("status", "new");
      if (error) throw error;
      return json({ unread: count ?? 0 });
    }
    const page = Math.max(1, Math.min(100000, Number(req.nextUrl.searchParams.get("page")) || 1));
    const status = z.enum(requestStatuses).safeParse(req.nextUrl.searchParams.get("status"));
    let query = client.from("supplement_requests").select("id,supplement_name,brand,upc,size,strength,form,customer_name,email,phone,notes,status,created_at", { count: "exact" });
    if (status.success) query = query.eq("status", status.data);
    const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range((page - 1) * 25, page * 25 - 1);
    if (error) throw error;
    return json({ items: data ?? [], total: count ?? 0, page });
  } catch (error) { return fail(error); }
}

export async function PATCH(req: NextRequest) {
  try { assertSameOrigin(req); } catch { return json({ detail: "Invalid request origin." }, 403); }
  try {
    await requireAdmin(req);
    const parsed = z.object({ id: z.uuid(), status: z.enum(requestStatuses) }).strict().safeParse(await req.json());
    if (!parsed.success) return json({ detail: "Invalid request status." }, 400);
    const client = await getSupabaseServerClient();
    if (!client) return json({ detail: "Requests are temporarily unavailable." }, 503);
    const { data, error } = await client.from("supplement_requests").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return json({ detail: "Request not found." }, 404);
    return json({ ok: true });
  } catch (error) { return fail(error); }
}
