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
  getAdminOrder,
  getCatalogImport,
  getProductById,
  getSettings,
  listCatalogImports,
  listOrders,
  listOrdersForUser,
  listProducts,
  listPromotions,
  listTags,
  patchCatalogSource,
  patchSettings,
  previewCsv,
  recordAudit,
  resetDemoStore,
  updateBrand,
  updateOrderStatus,
  updateProduct,
} from "@/lib/demo-store/engine";
import type { ProductQuery } from "@/lib/api/types";
import { getUserFromRequest, requireAdmin, requireUser } from "@/lib/auth/server";
import { assertSameOrigin } from "@/lib/auth/origin";
import { catalogRepository, getDataProvider } from "@/lib/data/repository";
import { dashboard as supabaseDashboard } from "@/lib/data/supabase-catalog";
import {
  getAdminOrderFromDatabase,
  getCustomerOrder,
  listAdminOrderNotifications,
  listAdminOrders,
  listCustomerOrders,
  markAdminOrderSeen,
  submitOrderRequest,
  updateAdminOrderStatus,
} from "@/lib/data/supabase-orders";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  updateCustomerAddress,
} from "@/lib/data/supabase-addresses";
import { fastapiAdmin } from "@/lib/admin/fastapi-proxy";
import { revalidatePath } from "next/cache";
import {
  deleteAddress,
  listAddresses,
  saveAddress,
} from "@/lib/auth/mock-store";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ path: string[] }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function fail(err: unknown) {
  if (err instanceof ApiHttpError) {
    return NextResponse.json(err.body, { status: err.status });
  }
  console.error("Unhandled API route error", err);
  return NextResponse.json(
    { error: "error", detail: "An unexpected server error occurred." },
    { status: 500 },
  );
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

function requireSameOrigin(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    throw new ApiHttpError(403, "Invalid request origin.", "forbidden");
  }
}

function revalidateStorefront() {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/sales");
  revalidatePath("/admin/products");
}

async function audit(req: NextRequest, action: string, entityType: string, entityId: string | number | null, summary: string) {
  try {
    const user = await getUserFromRequest(req);
    recordAudit({
      actor_user_id: user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      summary,
      request_id: req.headers.get("x-request-id") ?? req.headers.get("x-vercel-id"),
    });
  } catch {
    /* never fail the mutation because audit logging failed */
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const key = join(path);

    const repo = catalogRepository();
    if (key === "products") return json(await Promise.resolve(repo.listProducts(productQuery(sp))));
    if (key === "products/suggestions") return json(await Promise.resolve(repo.suggestions(sp.get("q") ?? "")));
    if (key === "products/filters") return json(await Promise.resolve(repo.filters()));
    if (path[0] === "products" && path.length === 2) return json(await Promise.resolve(repo.getProductBySlug(path[1])));
    if (path[0] === "products" && path[2] === "related") return json(await Promise.resolve(repo.relatedFor(path[1])));

    if (key === "brands") return json(await Promise.resolve(repo.listBrands()));
    if (path[0] === "brands" && path.length === 2) return json(await Promise.resolve(repo.getBrand(path[1])));
    if (key === "categories") return json(await Promise.resolve(repo.listCategories()));
    if (path[0] === "categories" && path.length === 2) return json(await Promise.resolve(repo.getCategory(path[1])));
    if (key === "tags") return json(listTags());
    if (key === "store-settings") return json(getSettings());
    if (key === "promotions") return json(listPromotions().filter((p) => p.is_active));

    if (path[0] === "orders" && path.length === 2) {
      const user = await requireUser(req);
      if (getDataProvider() === "supabase") {
        return json(await getCustomerOrder(path[1], user.id));
      }
      const order = listOrdersForUser(user.id).find((item) => item.public_token === path[1]);
      if (!order) throw new ApiHttpError(404, "Order not found.", "not_found");
      return json(order);
    }

    if (key === "account/profile") {
      const user = await requireUser(req);
      const addresses = getDataProvider() === "supabase"
        ? await listCustomerAddresses(user.id)
        : listAddresses(user.id);
      return json({ user, addresses });
    }
    if (key === "account/addresses") {
      const user = await requireUser(req);
      if (getDataProvider() === "supabase") {
        return json(await listCustomerAddresses(user.id));
      }
      return json(listAddresses(user.id));
    }
    if (key === "account/orders") {
      const user = await requireUser(req);
      if (getDataProvider() === "supabase") {
        return json({ items: await listCustomerOrders(user.id) });
      }
      return json({ items: listOrdersForUser(user.id) });
    }

    if (path[0] === "admin") {
      await requireAdmin(req);
    }
    if (getDataProvider() === "supabase" && key === "admin/products") {
      const qs = req.nextUrl.searchParams.toString();
      return json(await fastapiAdmin(`/products${qs ? `?${qs}` : ""}`));
    }
    if (getDataProvider() === "supabase" && path[0] === "admin" && path[1] === "products" && path.length === 3) {
      return json(await fastapiAdmin(`/products/${path[2]}`));
    }
    if (key === "admin/dashboard") {
      if (getDataProvider() === "supabase") return json(await supabaseDashboard());
      return json(dashboard());
    }
    if (key === "admin/brands") {
      if (getDataProvider() === "supabase") return json(await fastapiAdmin("/brands"));
      return json(await Promise.resolve(repo.listBrands()));
    }
    if (key === "admin/products") return json(listProducts(productQuery(sp), true));
    if (path[0] === "admin" && path[1] === "products" && path.length === 3 && path[2] !== "bulk-import") {
      return json(getProductById(Number(path[2])));
    }
    if (key === "admin/products/bulk-import/template") {
      return new NextResponse(`\uFEFF${CSV_TEMPLATE}`, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="bronxville-product-import-template.csv"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (key === "admin/orders") {
      if (getDataProvider() === "supabase") {
        return json(await listAdminOrders({
          q: sp.get("q") || undefined,
          status: sp.get("status") || undefined,
          page: Number(sp.get("page") || "1"),
        }));
      }
      return json(listOrders({ q: sp.get("q") || undefined, status: sp.get("status") || undefined, page: Number(sp.get("page") || "1") }));
    }
    if (key === "admin/order-notifications") {
      if (getDataProvider() === "supabase") {
        const items = await listAdminOrderNotifications();
        return json({ items, unread_count: items.length });
      }
      return json({ items: [], unread_count: 0 });
    }
    if (path[0] === "admin" && path[1] === "orders" && path.length === 3) {
      if (getDataProvider() === "supabase") {
        return json(await getAdminOrderFromDatabase(Number(path[2])));
      }
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
    if (path[0] === "admin" || path[0] === "account") requireSameOrigin(req);

    if (key === "orders") {
      requireSameOrigin(req);
      const user = await requireUser(req);
      const body = await readJson(req);
      body.user_id = user.id;
      if (getDataProvider() === "supabase") {
        return json(await submitOrderRequest(body, user), 201);
      }
      return json(createOrder(body), 201);
    }
    if (key === "account/addresses") {
      requireSameOrigin(req);
      const user = await requireUser(req);
      const body = await readJson(req);
      if (getDataProvider() === "supabase") {
        return json(await createCustomerAddress(user.id, body), 201);
      }
      const now = new Date().toISOString();
      const address = saveAddress(user.id, {
        id: randomUUID(),
        userId: user.id,
        label: String(body.label ?? "Saved address"),
        recipientName: String(body.recipientName ?? body.recipient_name ?? ""),
        phone: (body.phone as string) ?? null,
        addressLine1: String(body.addressLine1 ?? body.address_line1 ?? ""),
        addressLine2: (body.addressLine2 as string) ?? (body.address_line2 as string) ?? null,
        city: String(body.city ?? ""),
        state: String(body.state ?? ""),
        postalCode: String(body.postalCode ?? body.postal_code ?? ""),
        countryCode: String(body.countryCode ?? body.country_code ?? "US"),
        deliveryInstructions: (body.deliveryInstructions as string) ?? (body.delivery_instructions as string) ?? null,
        isDefault: Boolean(body.isDefault ?? body.is_default),
        createdAt: now,
        updatedAt: now,
      });
      return json(address, 201);
    }
    if (path[0] === "admin") await requireAdmin(req);
    if (getDataProvider() === "supabase" && key === "admin/products") {
      const created = await fastapiAdmin("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await readJson(req)),
      });
      revalidateStorefront();
      return json(created, 201);
    }
    if (getDataProvider() === "supabase" && path[0] === "admin" && path[1] === "products" && path[3] === "image") {
      const form = await req.formData();
      const uploaded = await fastapiAdmin(`/products/${path[2]}/image`, { method: "POST", body: form });
      revalidateStorefront();
      return json(uploaded);
    }
    if (key === "admin/products") {
      const created = createProduct(await readJson(req));
      await audit(req, "product.create", "product", created.id, `Created ${created.name}`);
      return json(created, 201);
    }
    if (path[0] === "admin" && path[1] === "products" && path[3] === "duplicate") {
      if (getDataProvider() === "supabase") {
        return json({ error: "not_supported", detail: "Duplicate is not available for live catalog rows." }, 400);
      }
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
    if (key === "admin/brands") {
      if (getDataProvider() === "supabase") {
        const created = await fastapiAdmin("/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(await readJson(req)),
        });
        revalidateStorefront();
        return json(created, 201);
      }
      const created = createBrand((await readJson(req)) as { name: string });
      await audit(req, "brand.create", "brand", created.id, `Created brand ${created.name}`);
      return json(created, 201);
    }
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
    if (key === "dev/reset" || key === "dev/seed") {
      await requireAdmin(req);
      return json(resetDemoStore());
    }
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
    if (path[0] === "admin" || path[0] === "account") requireSameOrigin(req);
    const body = await readJson(req);

    if (key === "admin/store-settings") {
      await requireAdmin(req);
      const updated = patchSettings(body);
      await audit(req, "settings.update", "store_settings", 1, "Updated store settings");
      return json(updated);
    }
    if (path[0] === "admin" && path[1] === "products" && path.length === 3) {
      await requireAdmin(req);
      if (getDataProvider() === "supabase") {
        const updated = await fastapiAdmin(`/products/${path[2]}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        revalidateStorefront();
        return json(updated);
      }
      const updated = updateProduct(Number(path[2]), body);
      await audit(req, "product.update", "product", updated.id, `Updated ${updated.name}`);
      return json(updated);
    }
    if (path[0] === "admin" && path[1] === "brands" && path.length === 3) {
      await requireAdmin(req);
      if (getDataProvider() === "supabase") {
        const updated = await fastapiAdmin(`/brands/${path[2]}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        revalidateStorefront();
        return json(updated);
      }
      const updated = updateBrand(Number(path[2]), body);
      await audit(req, "brand.update", "brand", updated.id, `Updated brand ${updated.name}`);
      return json(updated);
    }
    if (path[0] === "admin" && path[1] === "orders" && path[3] === "status") {
      requireSameOrigin(req);
      await requireAdmin(req);
      if (getDataProvider() === "supabase") {
        const status = typeof body.status === "string" ? body.status : undefined;
        const paymentStatus = typeof body.payment_status === "string" ? body.payment_status : undefined;
        const updated = await updateAdminOrderStatus(Number(path[2]), status, paymentStatus);
        revalidatePath("/admin");
        revalidatePath("/admin/orders");
        return json(updated);
      }
      const status = typeof body.status === "string" ? body.status : undefined;
      const paymentStatus = typeof body.payment_status === "string" ? body.payment_status : undefined;
      const updated = updateOrderStatus(Number(path[2]), status, paymentStatus);
      await audit(req, "order.status", "order", updated.id, `Status ${updated.status}`);
      return json(updated);
    }
    if (path[0] === "admin" && path[1] === "order-notifications" && path.length === 3) {
      requireSameOrigin(req);
      await requireAdmin(req);
      if (getDataProvider() === "supabase") {
        await markAdminOrderSeen(Number(path[2]));
      }
      return json({ ok: true });
    }
    if (key === "account/profile") {
      const user = await requireUser(req);
      const supabase = await (await import("@/lib/supabase/server")).getSupabaseServerClient();
      if (!supabase) throw new ApiHttpError(503, "Supabase is not configured.", "config");
      const username = String(body.username ?? user.username);
      const fullName = String(body.fullName ?? body.full_name ?? body.displayName ?? user.fullName);
      const phone = typeof body.phone === "string" ? body.phone : user.phone;
      const avatarUrl =
        typeof body.avatarUrl === "string"
          ? body.avatarUrl
          : typeof body.avatar_url === "string"
            ? body.avatar_url
            : user.avatarUrl;
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          full_name: fullName,
          phone: phone || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", user.id);
      if (error) {
        throw new ApiHttpError(400, error.code === "23505" ? "That username is already taken." : "Could not save profile.", "validation");
      }
      return json({ user: { ...user, username, fullName, displayName: fullName, phone, avatarUrl } });
    }
    if (path[0] === "account" && path[1] === "addresses" && path.length === 3) {
      requireSameOrigin(req);
      const user = await requireUser(req);
      if (getDataProvider() === "supabase") {
        return json(await updateCustomerAddress(user.id, path[2], body));
      }
      const existing = listAddresses(user.id).find((a) => a.id === path[2]);
      if (!existing) throw new ApiHttpError(404, "Address not found.", "not_found");
      const saved = saveAddress(user.id, {
        ...existing,
        label: String(body.label ?? existing.label ?? ""),
        recipientName: String(body.recipientName ?? body.recipient_name ?? existing.recipientName),
        phone: (body.phone as string) ?? existing.phone,
        addressLine1: String(body.addressLine1 ?? body.address_line1 ?? existing.addressLine1),
        addressLine2: (body.addressLine2 as string) ?? existing.addressLine2,
        city: String(body.city ?? existing.city),
        state: String(body.state ?? existing.state),
        postalCode: String(body.postalCode ?? body.postal_code ?? existing.postalCode),
        deliveryInstructions: (body.deliveryInstructions as string) ?? existing.deliveryInstructions,
        isDefault: Boolean(body.isDefault ?? body.is_default ?? existing.isDefault),
        updatedAt: new Date().toISOString(),
      });
      return json(saved);
    }
    if (path[0] === "admin") await requireAdmin(req);
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

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    if (path[0] === "admin" || path[0] === "account") requireSameOrigin(req);
    if (path[0] === "account" && path[1] === "addresses" && path.length === 3) {
      requireSameOrigin(req);
      const user = await requireUser(req);
      if (getDataProvider() === "supabase") {
        await deleteCustomerAddress(user.id, path[2]);
        return new NextResponse(null, { status: 204 });
      }
      deleteAddress(user.id, path[2]);
      return json({ ok: true });
    }
    if (
      path[0] === "admin" &&
      path[1] === "products" &&
      path.length === 4 &&
      path[3] === "permanent"
    ) {
      await requireAdmin(req);
      const body = await readJson(req);
      if (body.confirmation !== "CONFIRM") {
        throw new ApiHttpError(422, "Type CONFIRM to delete this product.", "validation_error");
      }
      if (getDataProvider() !== "supabase") {
        throw new ApiHttpError(
          400,
          "Permanent product deletion is only available for the live catalog.",
          "not_supported",
        );
      }
      const deleted = await fastapiAdmin(`/products/${path[2]}/permanent`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: body.confirmation }),
      });
      revalidateStorefront();
      return json(deleted);
    }
    if (path[0] === "admin" && path[1] === "products" && path.length === 3) {
      await requireAdmin(req);
      if (getDataProvider() === "supabase") {
        const archived = await fastapiAdmin(`/products/${path[2]}`, { method: "DELETE" });
        revalidateStorefront();
        return json(archived);
      }
      const archived = archiveProduct(Number(path[2]));
      await audit(req, "product.archive", "product", archived.id, `Archived ${archived.name}`);
      return json(archived);
    }
    return json({ error: "not_found", detail: "Unknown endpoint." }, 404);
  } catch (err) {
    return fail(err);
  }
}
