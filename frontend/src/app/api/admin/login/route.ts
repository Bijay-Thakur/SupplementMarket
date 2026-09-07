import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Demo administrator login has been removed. Use /api/auth?action=sign-in. */
export async function POST() {
  return NextResponse.json(
    { error: "gone", detail: "Use the administrator sign-in form at /admin/login." },
    { status: 410 },
  );
}
