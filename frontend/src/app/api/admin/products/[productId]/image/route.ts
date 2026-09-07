import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/server";
import { fastapiAdmin } from "@/lib/admin/fastapi-proxy";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { assertSameOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
  try {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "forbidden", detail: "Invalid request origin." }, { status: 403 });
    }
    await requireAdmin(req);
    const { productId } = await ctx.params;
    const form = await req.formData();
    const result = await fastapiAdmin(`/products/${productId}/image`, { method: "POST", body: form });
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin/products");
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiHttpError) return NextResponse.json(err.body, { status: err.status });
    return NextResponse.json({ error: "error", detail: "Image upload failed." }, { status: 500 });
  }
}
