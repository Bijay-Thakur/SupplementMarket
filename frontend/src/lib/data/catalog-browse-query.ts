import type { ProductQuery } from "@/lib/api/types";

/** Only use the database fast path for semantics implemented by its RPC. */
export function canBrowseInDatabase(query: ProductQuery) {
  return !query.q?.trim() && !query.form && !query.availability && !query.dietary?.length &&
    query.price_min == null && query.price_max == null &&
    [undefined, "relevance", "name_asc", "newest"].includes(query.sort);
}
