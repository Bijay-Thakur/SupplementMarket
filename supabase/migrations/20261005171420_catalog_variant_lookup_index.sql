-- Cover both default and non-default variants for catalog joins and fallback.
create index if not exists product_variants_product_lookup_idx
  on public.product_variants(product_id, is_default desc, id);
