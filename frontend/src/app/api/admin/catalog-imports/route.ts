import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { fastapiAdmin } from "@/lib/admin/fastapi-proxy";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { assertSameOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(err: unknown) {
  if (err instanceof ApiHttpError) {
    return NextResponse.json(err.body, { status: err.status });
  }
  return NextResponse.json({ error: "error", detail: "Import failed." }, { status: 500 });
}

export async function POST(req: NextRequest) {
  try {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "forbidden", detail: "Invalid request origin." }, { status: 403 });
    }
    await requireAdmin(req);
    const form = await req.formData();
    const res = await fastapiAdmin("/catalog-imports/preview", { method: "POST", body: form });
    return NextResponse.json(res);
  } catch (err) {
    return fail(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json(await fastapiAdmin("/catalog-imports"));
  } catch (err) {
    return fail(err);
  }
}
