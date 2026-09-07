/**
 * Dual-mode catalog repository. Storefront and admin share this contract.
 * Snapshot mode is session-only. Supabase mode is the production source of truth.
 */
import { serverEnv } from "@/lib/env/server";
import * as snapshot from "@/lib/demo-store/engine";
import { supabaseCatalog } from "./supabase-catalog";

export type DataProviderName = "snapshot" | "supabase";

export function getDataProvider(): DataProviderName {
  return serverEnv.dataProvider;
}

export function catalogRepository() {
  if (serverEnv.dataProvider === "supabase") {
    return supabaseCatalog;
  }
  return snapshot;
}
