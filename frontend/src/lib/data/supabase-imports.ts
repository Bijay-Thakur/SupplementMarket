import "server-only";

import { ApiHttpError } from "@/lib/demo-store/engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type CatalogImportBatchSummary = {
  id: string;
  filename: string;
  status: string;
  inserted_rows: number;
  updated_rows: number;
  unchanged_rows: number;
  created_at: string;
};

export async function listCatalogImportBatches(): Promise<CatalogImportBatchSummary[]> {
  const client = getSupabaseAdminClient();
  if (!client) throw new ApiHttpError(503, "Supabase is not configured.", "config");

  const { data, error } = await client
    .from("catalog_import_batches")
    .select("id,filename,status,inserted_rows,updated_rows,unchanged_rows,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new ApiHttpError(503, "Import history is unavailable.", "upstream");
  }

  return (data ?? []).map((batch) => ({
    id: String(batch.id),
    filename: String(batch.filename),
    status: String(batch.status),
    inserted_rows: Number(batch.inserted_rows ?? 0),
    updated_rows: Number(batch.updated_rows ?? 0),
    unchanged_rows: Number(batch.unchanged_rows ?? 0),
    created_at: String(batch.created_at),
  }));
}
