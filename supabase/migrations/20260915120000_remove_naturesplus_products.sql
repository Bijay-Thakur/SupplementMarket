-- One-time catalog cleanup requested by the store owner. Match only the
-- normalized Nature's Plus / NaturesPlus brand identity; similarly named
-- Nature's Way products are deliberately unaffected.

do $$
declare
  v_deleted_products integer := 0;
  v_deleted_brands integer := 0;
begin
  delete from public.products as product
  using public.brands as brand
  where product.brand_id = brand.id
    and regexp_replace(lower(coalesce(brand.name, '') || coalesce(brand.slug, '')), '[^a-z0-9]+', '', 'g')
        like '%naturesplus%';
  get diagnostics v_deleted_products = row_count;

  delete from public.brands as brand
  where regexp_replace(lower(coalesce(brand.name, '') || coalesce(brand.slug, '')), '[^a-z0-9]+', '', 'g')
        like '%naturesplus%'
    and not exists (
      select 1 from public.products as product where product.brand_id = brand.id
    );
  get diagnostics v_deleted_brands = row_count;

  raise notice 'Removed % Nature''s Plus products and % now-unused brand rows.',
    v_deleted_products,
    v_deleted_brands;
end;
$$;

notify pgrst, 'reload schema';
