import "server-only";

import type { Json } from "@/db/types";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_BUCKET = "product-images";

export type BulkProductDeleteResult = {
  ok: boolean;
  deleted_products: number;
  product_ids: string[];
  deleted_image_objects: number;
  warning?: string;
};

function deletionError(error: { code?: string; message?: string } | null): never {
  const message = String(error?.message || "Products could not be deleted.").slice(0, 240);
  if (error?.code === "22023") throw new ApiHttpError(422, message, "validation_error");
  if (error?.code === "P0002") throw new ApiHttpError(409, message, "conflict");
  if (["PGRST202", "PGRST204", "42883"].includes(error?.code ?? "")) {
    throw new ApiHttpError(
      503,
      "Product deletion is not configured. Apply the latest Supabase migrations.",
      "config",
    );
  }
  throw new ApiHttpError(503, "Products could not be deleted.", "upstream");
}

function resultPayload(data: Json, fallbackIds: string[]): BulkProductDeleteResult {
  const value = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, Json | undefined>
    : {};
  const ids = Array.isArray(value.product_ids)
    ? value.product_ids.filter((id): id is string => typeof id === "string")
    : fallbackIds;
  return {
    ok: value.ok !== false,
    deleted_products: typeof value.deleted_products === "number" ? value.deleted_products : ids.length,
    product_ids: ids,
    deleted_image_objects: 0,
  };
}

export async function deleteCatalogProducts(
  productIds: string[],
  confirmation: string,
): Promise<BulkProductDeleteResult> {
  if (confirmation !== "CONFIRM") {
    throw new ApiHttpError(422, "Confirm permanent deletion before continuing.", "validation_error");
  }
  if (productIds.length < 1 || productIds.length > 100 || productIds.some((id) => !UUID_PATTERN.test(id))) {
    throw new ApiHttpError(422, "Select between 1 and 100 valid products.", "validation_error");
  }
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length !== productIds.length) {
    throw new ApiHttpError(422, "Duplicate products are not allowed.", "validation_error");
  }

  const client = getSupabaseAdminClient();
  if (!client) throw new ApiHttpError(503, "Supabase is not configured.", "config");

  const { data: imageRows, error: imageError } = await client
    .from("product_images")
    .select("storage_path")
    .in("product_id", uniqueIds);
  if (imageError) {
    throw new ApiHttpError(503, "Product images could not be prepared for deletion.", "upstream");
  }
  const storagePaths = [...new Set(
    (imageRows ?? [])
      .map((image) => image.storage_path)
      .filter((path): path is string => Boolean(path) && !/^https?:\/\//i.test(path)),
  )];

  const { data, error } = await client.rpc("delete_catalog_products", {
    p_product_ids: uniqueIds,
    p_confirmation: confirmation,
  });
  if (error) deletionError(error);

  const result = resultPayload(data, uniqueIds);
  if (!storagePaths.length) return result;

  const stillReferenced = new Set<string>();
  for (let offset = 0; offset < storagePaths.length; offset += 50) {
    const paths = storagePaths.slice(offset, offset + 50);
    const { data: references, error: referenceError } = await client
      .from("product_images")
      .select("storage_path")
      .in("storage_path", paths);
    if (referenceError) {
      result.warning = "Products were deleted, but their image files could not be safely checked for cleanup.";
      return result;
    }
    for (const reference of references ?? []) {
      if (reference.storage_path) stillReferenced.add(reference.storage_path);
    }
  }

  const removable = storagePaths.filter((path) => !stillReferenced.has(path));
  let failedImageObjects = 0;
  for (let offset = 0; offset < removable.length; offset += 100) {
    const paths = removable.slice(offset, offset + 100);
    const { error: storageError } = await client.storage.from(STORAGE_BUCKET).remove(paths);
    if (storageError) failedImageObjects += paths.length;
    else result.deleted_image_objects += paths.length;
  }
  if (failedImageObjects) {
    result.warning = "Products were deleted, but some image files could not be safely cleaned up.";
  }
  return result;
}
