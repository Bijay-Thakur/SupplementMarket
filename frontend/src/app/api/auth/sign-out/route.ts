import { NextRequest } from "next/server";
import { createCookieRecordingClient } from "@/lib/supabase/route";
import { redirectWithAuthCookies } from "@/lib/supabase/cookies";
import { safeNextPath } from "@/lib/auth/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/");
  const { supabase, pending } = createCookieRecordingClient(request);
  if (supabase) await supabase.auth.signOut();
  return redirectWithAuthCookies(safeNextPath(next, "/"), pending);
}
