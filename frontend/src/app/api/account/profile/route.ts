import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/auth/schemas";
import { DUPLICATE_USERNAME_MESSAGE } from "@/lib/auth/types";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { assertSameOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof ApiHttpError) {
    return NextResponse.json(err.body, { status: err.status, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ error: "error", detail: "Could not update profile." }, { status: 500 });
}

export async function PATCH(req: NextRequest) {
  try {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "forbidden", detail: "Invalid request origin." }, { status: 403 });
    }
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", detail: parsed.error.issues[0]?.message || "Invalid profile." },
        { status: 400 },
      );
    }
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "config", detail: "Supabase is not configured." }, { status: 503 });
    }
    const { data, error } = await supabase
      .from("profiles")
      .update({
        username: parsed.data.username,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
        avatar_url: parsed.data.avatarUrl || null,
      })
      .eq("id", user.id)
      .select("username, full_name, phone, avatar_url, updated_at")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "validation", detail: DUPLICATE_USERNAME_MESSAGE }, { status: 400 });
      }
      return NextResponse.json({ error: "error", detail: "Could not save profile." }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "conflict", detail: "Your verified profile is not ready. Sign out, sign in again, and retry." },
        { status: 409, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        profile: {
          username: data.username ?? "",
          fullName: data.full_name ?? "",
          phone: data.phone ?? "",
          avatarUrl: data.avatar_url ?? "",
          updatedAt: data.updated_at,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return fail(err);
  }
}
