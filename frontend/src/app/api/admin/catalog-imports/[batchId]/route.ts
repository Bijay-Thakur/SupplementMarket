import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { fastapiAdmin } from "@/lib/admin/fastapi-proxy";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { assertSameOrigin } from "@/lib/auth/origin";

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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  try {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "forbidden", detail: "Invalid request origin." }, { status: 403 });
    }
    await requireAdmin(req);
    const { batchId } = await ctx.params;
    const body = (await req.json()) as { source_row_number?: number } & Record<string, unknown>;
    if (Array.isArray(body.included_row_numbers)) {
      return NextResponse.json(
        await fastapiAdmin(`/catalog-imports/${batchId}/selection`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ included_row_numbers: body.included_row_numbers }),
        }),
      );
    }
    if (!Number.isInteger(body.source_row_number)) {
      return NextResponse.json(
        { error: "validation_error", detail: "source_row_number is required." },
        { status: 422 },
      );
    }
    const sourceRowNumber = body.source_row_number as number;
    const patch = { ...body };
    delete patch.source_row_number;
    return NextResponse.json(
      await fastapiAdmin(`/catalog-imports/${batchId}/rows/${sourceRowNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );
  } catch (err) {
    if (err instanceof ApiHttpError) return NextResponse.json(err.body, { status: err.status });
    return NextResponse.json({ error: "error", detail: "Import row update failed." }, { status: 500 });
  }
}
