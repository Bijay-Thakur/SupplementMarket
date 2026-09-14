import "server-only";

import { z } from "zod";
import type { Tables } from "@/db/types";
import type { CustomerAddress } from "@/lib/auth/types";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type AddressRow = Tables<"customer_addresses">;

const addressSchema = z.object({
  label: z.string().trim().max(80).nullish(),
  recipientName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).nullish(),
  addressLine1: z.string().trim().min(2).max(240),
  addressLine2: z.string().trim().max(240).nullish(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(40),
  postalCode: z.string().trim().min(3).max(20),
  countryCode: z.string().trim().length(2).default("US"),
  deliveryInstructions: z.string().trim().max(1000).nullish(),
  isDefault: z.boolean().default(false),
});

function clientOrThrow() {
  const client = getSupabaseAdminClient();
  if (!client) throw new ApiHttpError(503, "The address service is not configured.", "config");
  return client;
}

function fail(error: { code?: string } | null, fallback: string): never {
  if (error?.code && ["PGRST204", "PGRST205", "42P01", "42703"].includes(error.code)) {
    throw new ApiHttpError(503, "The address database is not ready. Apply the latest Supabase migrations.", "config");
  }
  throw new ApiHttpError(503, fallback, "upstream");
}

function dto(row: AddressRow): CustomerAddress {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    deliveryInstructions: row.delivery_instructions,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseAddress(body: Record<string, unknown>) {
  const parsed = addressSchema.safeParse({
    label: body.label,
    recipientName: body.recipientName ?? body.recipient_name,
    phone: body.phone,
    addressLine1: body.addressLine1 ?? body.address_line1,
    addressLine2: body.addressLine2 ?? body.address_line2,
    city: body.city,
    state: body.state,
    postalCode: body.postalCode ?? body.postal_code,
    countryCode: body.countryCode ?? body.country_code ?? "US",
    deliveryInstructions: body.deliveryInstructions ?? body.delivery_instructions,
    isDefault: body.isDefault ?? body.is_default ?? false,
  });
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join(".") || "address", issue.message]),
    );
    throw new ApiHttpError(400, "Check the address and try again.", "validation", fields);
  }
  return parsed.data;
}

export async function listCustomerAddresses(userId: string) {
  const { data, error } = await clientOrThrow()
    .from("customer_addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) fail(error, "Saved addresses could not be loaded.");
  return (data ?? []).map((row) => dto(row));
}

export async function createCustomerAddress(userId: string, body: Record<string, unknown>) {
  const input = parseAddress(body);
  const client = clientOrThrow();
  if (input.isDefault) {
    const { error } = await client
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
    if (error) fail(error, "The default address could not be updated.");
  }
  const { data, error } = await client
    .from("customer_addresses")
    .insert({
      user_id: userId,
      label: input.label || null,
      recipient_name: input.recipientName,
      phone: input.phone || null,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2 || null,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country_code: input.countryCode.toUpperCase(),
      delivery_instructions: input.deliveryInstructions || null,
      is_default: input.isDefault,
    })
    .select("*")
    .single();
  if (error || !data) fail(error, "The address could not be saved.");
  return dto(data);
}

export async function updateCustomerAddress(
  userId: string,
  addressId: string,
  body: Record<string, unknown>,
) {
  const current = (await listCustomerAddresses(userId)).find((row) => row.id === addressId);
  if (!current) throw new ApiHttpError(404, "Address not found.", "not_found");
  const input = parseAddress({ ...current, ...body });
  const client = clientOrThrow();
  if (input.isDefault) {
    const { error } = await client
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .neq("id", addressId)
      .eq("is_default", true);
    if (error) fail(error, "The default address could not be updated.");
  }
  const { data, error } = await client
    .from("customer_addresses")
    .update({
      label: input.label || null,
      recipient_name: input.recipientName,
      phone: input.phone || null,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2 || null,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country_code: input.countryCode.toUpperCase(),
      delivery_instructions: input.deliveryInstructions || null,
      is_default: input.isDefault,
    })
    .eq("id", addressId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) fail(error, "The address could not be updated.");
  if (!data) throw new ApiHttpError(404, "Address not found.", "not_found");
  return dto(data);
}

export async function deleteCustomerAddress(userId: string, addressId: string) {
  const { data, error } = await clientOrThrow()
    .from("customer_addresses")
    .delete()
    .eq("id", addressId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) fail(error, "The address could not be removed.");
  if (!data) throw new ApiHttpError(404, "Address not found.", "not_found");
}
