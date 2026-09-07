import { NextRequest, NextResponse } from "next/server";
import { createCookieRecordingClient } from "@/lib/supabase/route";
import { redirectWithAuthCookies } from "@/lib/supabase/cookies";
import { safeNextPath } from "@/lib/auth/schemas";
import { assertSameOrigin, requestOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json(
      { error: "forbidden", detail: "Invalid request origin." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const form = await request.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/");
  const { supabase, pending } = createCookieRecordingClient(request);
  if (supabase) await supabase.auth.signOut();
  return redirectWithAuthCookies(safeNextPath(next, "/"), pending, requestOrigin(request));
}
