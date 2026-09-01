import { NextRequest, NextResponse } from "next/server";
import {
  ApiHttpError,
  CSV_TEMPLATE,
  archiveProduct,
  catalogSources,
  commitCsv,
  createBrand,
  createCatalogImport,
  createCategory,
  createOrder,
  createProduct,
  createPromotion,
  createTag,
  dashboard,
  duplicateProduct,
  filters,
  getAdminOrder,
  getBrand,
  getCatalogImport,
  getCategory,
  getOrderByToken,
  getProductById,
  getProductBySlug,
  getSettings,
  listBrands,
  listCatalogImports,
  listCategories,
  listOrders,
  listProducts,
  listPromotions,
  listTags,
  patchCatalogSource,
  patchSettings,
  previewCsv,
  relatedFor,
  resetDemoStore,
  suggestions,
  updateOrderStatus,
  updateProduct,
} from "@/lib/demo-store/engine";
import type { ProductQuery } from "@/lib/api/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function fail(err: unknown) {
  if (err instanceof ApiHttpError) {
    return NextResponse.json(err.body, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json({ error: "error", detail: message }, { status: 500 });
}

function boolParam(sp: URLSearchParams, key: string): boolean | undefined {
  const v = sp.get(key);
  if (v == null || v === "") return undefined;
  if (v === "1" || v === "true" || v === "True") return true;
  if (v === "0" || v === "false" || v === "False") return false;
  return undefined;
}

function productQuery(sp: URLSearchParams): ProductQuery {
  const dietary = sp.getAll("dietary");
  return {
    q: sp.get("q") || undefined,
    brand: sp.get("brand") || undefined,
    category: sp.get("category") || undefined,
    form: sp.get("form") || undefined,
    price_min: sp.get("price_min") ? Number(sp.get("price_min")) : undefined,
    price_max: sp.get("price_max") ? Number(sp.get("price_max")) : undefined,
    availability: sp.get("availability") || undefined,
    dietary: dietary.length ? dietary : undefined,
    featured: boolParam(sp, "featured"),
    bestseller: boolParam(sp, "bestseller"),
    is_new: boolParam(sp, "is_new"),
    on_sale: boolParam(sp, "on_sale"),
    sort: sp.get("sort") || undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    page_size: sp.get("page_size") ? Number(sp.get("page_size")) : undefined,
  };
}

async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiHttpError(400, "Invalid JSON body.", "validation");
  }
}

function join(path: string[]) {
  return path.join("/");
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const key = join(path);

    if (key === "products") return json(listProducts(productQuery(sp)));
    if (key === "products/suggestions") return json(suggestions(sp.get("q") ?? ""));
    if (key === "products/filters") return json(filters());
    if (path[0] === "products" && path.length === 2) return json(getProductBySlug(path[1]));
    if (path[0] === "products" && path[2] === "related") return json(relatedFor(path[1]));

    if (key === "brands") return json(listBrands());
    if (path[0] === "brands" && path.length === 2) return json(getBrand(path[1]));
    if (key === "categories") return json(listCategories());
    if (path[0] === "categories" && path.length === 2) return json(getCategory(path[1]));
    if (key === "tags") return json(listTags());
    if (key === "store-settings") return json(getSettings());
    if (key === "promotions") return json(listPromotions().filter((p) => p.is_active));

    if (path[0] === "orders" && path.length === 2) return json(getOrderByToken(path[1]));

    if (key === "admin/dashboard") return json(dashboard());
    if (key === "admin/products") return json(listProducts(productQuery(sp), true));
    if (path[0] === "admin" && path[1] === "products" && path.length === 3 && path[2] !== "bulk-import") {
      return json(getProductById(Number(path[2])));
    }
    if (key === "admin/products/bulk-import/template") {
      return new NextResponse(CSV_TEMPLATE, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=bnm-import-template.csv",
        },
      });
    }
    if (key === "admin/orders") {
      return json(listOrders({ q: sp.get("q") || undefined, status: sp.get("status") || undefined, page: Number(sp.get("page") || "1") }));
    }
    if (path[0] === "admin" && path[1] === "orders" && path.length === 3) {
      return json(getAdminOrder(Number(path[2])));
    }
    if (key === "admin/promotions") return json(listPromotions());
    if (key === "admin/catalog-sources") return json(catalogSources());
    if (key === "admin/catalog-imports") return json(listCatalogImports());
    if (path[0] === "admin" && path[1] === "catalog-imports" && path.length === 3) {
      return json(getCatalogImport(path[2]));
    }
    if (path[0] === "admin" && path[1] === "catalog-imports" && path[3] === "export") {
      return new NextResponse("id,name,status\n", {
        headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=catalog-export.csv" },
      });
    }
    if (path[0] === "admin" && path[1] === "catalog-imports" && path[3] === "errors") {
      return new NextResponse("No collector errors on the hosted demo.\n", { headers: { "Content-Type": "text/plain" } });
    }

    return json({ error: "not_found", detail: "Unknown endpoint." }, 404);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    const key = join(path);

    if (key === "orders") return json(createOrder(await readJson(req)), 201);
    if (key === "admin/products") return json(createProduct(await readJson(req)), 201);
    if (path[0] === "admin" && path[1] === "products" && path[3] === "duplicate") {
      return json(duplicateProduct(Number(path[2])), 201);
    }
    if (key === "admin/products/bulk-import/preview") {
      const form = await req.formData();
      const file = form.get("file");
      const text = file instanceof File ? await file.text() : "";
      return json(previewCsv(text));
    }
    if (key === "admin/products/bulk-import/commit") {
      const form = await req.formData();
      const file = form.get("file");
      const text = file instanceof File ? await file.text() : "";
      return json(commitCsv(text));
    }
    if (key === "admin/brands") return json(createBrand(await readJson(req) as { name: string }), 201);
    if (key === "admin/categories") return json(createCategory(await readJson(req) as { name: string }), 201);
    if (key === "admin/tags") return json(createTag(await readJson(req) as { name: string }), 201);
    if (key === "admin/promotions") {
      const body = await readJson(req);
      return json(
        createPromotion({
          name: String(body.name ?? ""),
          discount_percent: typeof body.discount_percent === "number" ? body.discount_percent : undefined,
          is_active: typeof body.is_active === "boolean" ? body.is_active : true,
        }),
        201,
      );
    }
    if (key === "admin/catalog-imports") return json(createCatalogImport(await readJson(req)), 201);
    if (key === "dev/reset" || key === "dev/seed") return json(resetDemoStore());
    if (path[0] === "admin" && path[1] === "catalog-imports" && ["approve", "reject", "import", "recalculate"].includes(path[3] ?? "")) {
      return json({ ok: false, updated: 0, created: 0, skipped: 0, detail: "Live catalog import is not available on the hosted demo." });
    }

    return json({ error: "not_found", detail: "Unknown endpoint." }, 404);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    const key = join(path);
    const body = await readJson(req);

    if (key === "admin/store-settings") return json(patchSettings(body));
    if (path[0] === "admin" && path[1] === "products" && path.length === 3) {
      return json(updateProduct(Number(path[2]), body));
    }
    if (path[0] === "admin" && path[1] === "orders" && path[3] === "status") {
      return json(updateOrderStatus(Number(path[2]), String(body.status ?? "")));
    }
    if (path[0] === "admin" && path[1] === "catalog-sources" && path.length === 3) {
      return json(patchCatalogSource(Number(path[2]), body));
    }
    if (path[0] === "admin" && path[1] === "catalog-imports" && path[3] === "products") {
      return json({ ok: false, detail: "Staged edits are not available on the hosted demo." }, 400);
    }

    return json({ error: "not_found", detail: "Unknown endpoint." }, 404);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    if (path[0] === "admin" && path[1] === "products" && path.length === 3) {
      return json(archiveProduct(Number(path[2])));
    }
    return json({ error: "not_found", detail: "Unknown endpoint." }, 404);
  } catch (err) {
    return fail(err);
  }
}
