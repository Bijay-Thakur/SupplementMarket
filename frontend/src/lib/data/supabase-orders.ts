import "server-only";

import { z } from "zod";
import type { AuthUser } from "@/lib/auth/types";
import type {
  AdminOrderDetail,
  AdminOrderNotification,
  AdminOrderRow,
  OrderPublic,
  Page,
} from "@/lib/api/types";
import type { Tables, TablesUpdate } from "@/db/types";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type OrderRow = Tables<"orders">;
type OrderItemRow = Tables<"order_items">;
type OrderWithItems = OrderRow & { order_items: OrderItemRow[] | null };
const MIGRATION_ERROR_CODES = new Set(["PGRST202", "PGRST204", "PGRST205", "42P01", "42703"]);

const ORDER_SELECT =
  "id,public_token,order_number,user_id,fulfillment_type,status,customer_name,customer_email,customer_phone,delivery_address_line1,delivery_address_line2,delivery_city,delivery_state,delivery_zip,delivery_instructions,payment_method,payment_status,currency,subtotal_cents,delivery_fee_cents,total_cents,notes,is_demo,placed_at,paid_at,admin_seen_at,cancelled_at,created_at,updated_at,order_items(id,product_id,product_name,brand_name,sku,unit_price_cents,quantity,line_total_cents,created_at)" as const;

const requestSchema = z
  .object({
    idempotency_key: z.string().uuid(),
    fulfillment_type: z.enum(["pickup", "delivery"]),
    payment_method: z.string().optional(),
    customer_name: z.string().trim().min(2).max(160),
    customer_email: z.string().optional(),
    customer_phone: z.string().trim().min(5).max(40),
    delivery_address_line1: z.string().trim().max(240).default(""),
    delivery_address_line2: z.string().trim().max(240).nullish(),
    delivery_city: z.string().trim().max(120).default(""),
    delivery_state: z.string().trim().max(40).default(""),
    delivery_zip: z.string().trim().max(20).default(""),
    delivery_instructions: z.string().trim().max(1000).nullish(),
    items: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillment_type !== "delivery") return;
    for (const field of ["delivery_address_line1", "delivery_city", "delivery_state"] as const) {
      if (value[field].length < 2) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required for delivery",
        });
      }
    }
    if (value.delivery_zip.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_zip"],
        message: "Required for delivery",
      });
    }
  });

const ORDER_STATUSES = new Set([
  "placed",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "shipped",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
]);
const PAYMENT_STATUSES = new Set(["unpaid", "paid"]);

function clientOrThrow() {
  const client = getSupabaseAdminClient();
  if (!client) throw new ApiHttpError(503, "The order service is not configured.", "config");
  return client;
}

function databaseError(
  error: { code?: string; message?: string } | null,
  fallback: string,
): never {
  if (error?.code && MIGRATION_ERROR_CODES.has(error.code)) {
    throw new ApiHttpError(
      503,
      "The order database is not ready. Apply the latest Supabase migrations.",
      "config",
    );
  }
  if (error?.code === "22023") {
    const detail = String(error.message || fallback).slice(0, 240);
    throw new ApiHttpError(400, detail, "validation");
  }
  throw new ApiHttpError(503, fallback, "upstream");
}

function itemsOf(row: OrderWithItems): OrderPublic["items"] {
  return (row.order_items ?? []).map((item) => ({
    product_name: item.product_name,
    brand_name: item.brand_name,
    sku: item.sku,
    unit_price_cents: Number(item.unit_price_cents),
    quantity: Number(item.quantity),
    line_total_cents: Number(item.line_total_cents),
  }));
}

function toPublicOrder(row: OrderWithItems): OrderPublic {
  return {
    public_token: row.public_token,
    order_number: row.order_number,
    status: row.status,
    fulfillment_type: row.fulfillment_type,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    currency: row.currency,
    customer_name: row.customer_name,
    subtotal_cents: Number(row.subtotal_cents),
    delivery_fee_cents: row.delivery_fee_cents == null ? null : Number(row.delivery_fee_cents),
    total_cents: Number(row.total_cents),
    items: itemsOf(row),
    created_at: row.created_at,
    persistence: "database",
  };
}

function toAdminDetail(row: OrderWithItems): AdminOrderDetail {
  const items = itemsOf(row);
  return {
    id: Number(row.id),
    public_token: row.public_token,
    order_number: row.order_number,
    user_id: row.user_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    fulfillment_type: row.fulfillment_type,
    status: row.status,
    delivery_address_line1: row.delivery_address_line1,
    delivery_address_line2: row.delivery_address_line2,
    delivery_city: row.delivery_city,
    delivery_state: row.delivery_state,
    delivery_zip: row.delivery_zip,
    delivery_instructions: row.delivery_instructions,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    currency: row.currency,
    subtotal_cents: Number(row.subtotal_cents),
    delivery_fee_cents: row.delivery_fee_cents == null ? null : Number(row.delivery_fee_cents),
    total_cents: Number(row.total_cents),
    notes: row.notes,
    is_demo: row.is_demo,
    item_count: items.reduce((total, item) => total + item.quantity, 0),
    items,
    created_at: row.created_at,
    placed_at: row.placed_at,
    paid_at: row.paid_at,
    admin_seen_at: row.admin_seen_at,
    cancelled_at: row.cancelled_at,
  };
}

function toAdminRow(row: OrderWithItems): AdminOrderRow {
  const detail = toAdminDetail(row);
  return {
    id: detail.id,
    order_number: detail.order_number,
    customer_name: detail.customer_name,
    fulfillment_type: detail.fulfillment_type,
    status: detail.status,
    payment_status: detail.payment_status,
    total_cents: detail.total_cents,
    item_count: detail.item_count,
    is_demo: detail.is_demo,
    created_at: detail.created_at,
  };
}

async function orderById(id: number): Promise<OrderWithItems> {
  const { data, error } = await clientOrThrow()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) databaseError(error, "The order could not be loaded.");
  if (!data) throw new ApiHttpError(404, "Order not found.", "not_found");
  return data as unknown as OrderWithItems;
}

export async function submitOrderRequest(body: Record<string, unknown>, user: AuthUser) {
  if (body.payment_method === "card") {
    throw new ApiHttpError(
      400,
      "Online payment is not available. Submit the order and call the store.",
      "payment_disabled",
    );
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "order"] = issue.message;
    }
    throw new ApiHttpError(400, "Check the order details and try again.", "validation", fields);
  }
  if (!user.email) {
    throw new ApiHttpError(400, "A verified account email is required.", "validation");
  }

  const input = parsed.data;
  const { data, error } = await clientOrThrow().rpc("submit_order_request", {
    p_user_id: user.id,
    p_idempotency_key: input.idempotency_key,
    p_fulfillment_type: input.fulfillment_type,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_delivery_address_line1: input.delivery_address_line1,
    p_delivery_address_line2: input.delivery_address_line2 ?? "",
    p_delivery_city: input.delivery_city,
    p_delivery_state: input.delivery_state,
    p_delivery_zip: input.delivery_zip,
    p_delivery_instructions: input.delivery_instructions ?? "",
    p_items: input.items,
  });
  if (error) databaseError(error, "The order could not be submitted.");
  const id = Number(data);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiHttpError(503, "The order could not be submitted.", "upstream");
  }
  return toPublicOrder(await orderById(id));
}

export async function getCustomerOrder(publicToken: string, userId: string) {
  const { data, error } = await clientOrThrow()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("public_token", publicToken)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) databaseError(error, "The order could not be loaded.");
  if (!data) throw new ApiHttpError(404, "Order not found.", "not_found");
  return toPublicOrder(data as unknown as OrderWithItems);
}

export async function listCustomerOrders(userId: string) {
  const { data, error } = await clientOrThrow()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) databaseError(error, "Orders could not be loaded.");
  return (data ?? []).map((row) => toPublicOrder(row as unknown as OrderWithItems));
}

export async function listAdminOrders(params: {
  q?: string;
  status?: string;
  page?: number;
}): Promise<Page<AdminOrderRow>> {
  const { data, error } = await clientOrThrow()
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) databaseError(error, "Orders could not be loaded.");
  let rows = (data ?? []).map((row) => toAdminRow(row as unknown as OrderWithItems));
  const needle = params.q?.trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (row) =>
        row.order_number.toLowerCase().includes(needle) ||
        row.customer_name.toLowerCase().includes(needle),
    );
  }
  if (params.status) rows = rows.filter((row) => row.status === params.status);
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const pageSize = 25;
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(rows.length / pageSize)),
  };
}

export async function getAdminOrderFromDatabase(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiHttpError(400, "Invalid order id.", "validation");
  }
  return toAdminDetail(await orderById(id));
}

export async function updateAdminOrderStatus(
  id: number,
  status: string | undefined,
  paymentStatus?: string,
) {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiHttpError(400, "Invalid order id.", "validation");
  }
  if (status !== undefined && !ORDER_STATUSES.has(status)) {
    throw new ApiHttpError(400, "Invalid order status.", "validation");
  }
  if (paymentStatus !== undefined && !PAYMENT_STATUSES.has(paymentStatus)) {
    throw new ApiHttpError(400, "Invalid payment status.", "validation");
  }
  if (status === undefined && paymentStatus === undefined) {
    throw new ApiHttpError(400, "Choose an order or payment status.", "validation");
  }
  const current = await orderById(id);
  const nextStatus = status ?? current.status;
  const incompatible = current.fulfillment_type === "pickup"
    ? new Set(["shipped", "out_for_delivery", "delivered"]).has(nextStatus)
    : nextStatus === "ready_for_pickup";
  if (incompatible) {
    throw new ApiHttpError(400, "That status does not match the order fulfillment type.", "validation");
  }
  const update: TablesUpdate<"orders"> = {};
  if (status !== undefined) {
    update.status = status;
    update.cancelled_at = status === "cancelled" ? new Date().toISOString() : null;
  }
  if (paymentStatus !== undefined) {
    update.payment_status = paymentStatus;
    update.paid_at = paymentStatus === "paid" ? new Date().toISOString() : null;
  }
  const { error } = await clientOrThrow()
    .from("orders")
    .update(update)
    .eq("id", id);
  if (error) databaseError(error, "The order status could not be updated.");
  return getAdminOrderFromDatabase(id);
}

export async function listAdminOrderNotifications(): Promise<AdminOrderNotification[]> {
  const { data, error } = await clientOrThrow()
    .from("orders")
    .select("id,order_number,customer_name,fulfillment_type,total_cents,created_at")
    .is("admin_seen_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) databaseError(error, "Order notifications could not be loaded.");
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    order_number: row.order_number,
    customer_name: row.customer_name,
    fulfillment_type: row.fulfillment_type,
    total_cents: Number(row.total_cents),
    created_at: row.created_at,
  }));
}

export async function markAdminOrderSeen(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiHttpError(400, "Invalid order id.", "validation");
  }
  const { data, error } = await clientOrThrow()
    .from("orders")
    .update({ admin_seen_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) databaseError(error, "The notification could not be updated.");
  if (!data) throw new ApiHttpError(404, "Order not found.", "not_found");
}

export async function orderDashboardSummary() {
  const { data, error, count } = await clientOrThrow()
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(5);
  // Keep the catalog dashboard available during a rolling deploy where the
  // application reaches production just before this migration is applied.
  if (error?.code && MIGRATION_ERROR_CODES.has(error.code)) {
    return { total: 0, recent: [] as AdminOrderRow[] };
  }
  if (error) databaseError(error, "Order totals could not be loaded.");
  return {
    total: count ?? 0,
    recent: (data ?? []).map((row) => toAdminRow(row as unknown as OrderWithItems)),
  };
}
