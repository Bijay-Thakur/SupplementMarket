/**
 * Dual-mode catalog repository. Storefront and admin share this contract.
 * Snapshot mode is session-only. Supabase mode is the production source of truth.
 */
import { serverEnv } from "@/lib/env/server";
import * as snapshot from "@/lib/demo-store/engine";

export type DataProviderName = "snapshot" | "supabase";

export function getDataProvider(): DataProviderName {
  return serverEnv.dataProvider;
}

export function catalogRepository() {
  if (serverEnv.dataProvider === "supabase") {
    throw new snapshot.ApiHttpError(
      503,
      "DATA_PROVIDER=supabase is configured but the live repository requires a provisioned project. Apply supabase/migrations and run scripts/import-catalog-to-supabase.mjs.",
      "config",
    );
  }
  return snapshot;
}
