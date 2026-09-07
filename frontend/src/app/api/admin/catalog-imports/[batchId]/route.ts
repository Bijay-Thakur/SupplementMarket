import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { fastapiAdmin } from "@/lib/admin/fastapi-proxy";
import { ApiHttpError } from "@/lib/demo-store/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  try {
    await requireAdmin(req);
    const { batchId } = await ctx.params;
    return NextResponse.json(await fastapiAdmin(`/catalog-imports/${batchId}`));
  } catch (err) {
    if (err instanceof ApiHttpError) return NextResponse.json(err.body, { status: err.status });
    return NextResponse.json({ error: "error", detail: "Import lookup failed." }, { status: 500 });
  }
}
