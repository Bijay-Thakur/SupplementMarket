-- Incremental administrator catalog authorization.
-- Public read of active catalog rows is unchanged.
-- Wholesale cost remains unggranted to public and customer roles.
-- Passwords are never stored in application tables.

-- ---------------------------------------------------------
-- Catalog table grants (RLS still restricts writes to is_admin())
-- ---------------------------------------------------------

grant insert, update, delete on public.brands to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant insert, update, delete on public.product_tags to authenticated;

-- Variant writes are admin-only via RLS. cost_price_cents remains absent from
-- the public SELECT grant so storefront/customer queries cannot read wholesale.
grant insert, update, delete on public.product_variants to authenticated;

grant select, insert, update, delete on public.catalog_import_batches to authenticated;
grant select, insert, update, delete on public.catalog_import_rows to authenticated;

-- ---------------------------------------------------------
-- Administrator policies
-- ---------------------------------------------------------

drop policy if exists "Admins read all brands" on public.brands;
create policy "Admins read all brands"
on public.brands for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write brands" on public.brands;
create policy "Admins write brands"
on public.brands for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins read all categories" on public.categories;
create policy "Admins read all categories"
on public.categories for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write categories" on public.categories;
create policy "Admins write categories"
on public.categories for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins read all products" on public.products;
create policy "Admins read all products"
on public.products for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write products" on public.products;
create policy "Admins write products"
on public.products for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins read all variants" on public.product_variants;
create policy "Admins read all variants"
on public.product_variants for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write variants" on public.product_variants;
create policy "Admins write variants"
on public.product_variants for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins read all product images" on public.product_images;
create policy "Admins read all product images"
on public.product_images for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write product images" on public.product_images;
create policy "Admins write product images"
on public.product_images for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins read all product tags" on public.product_tags;
create policy "Admins read all product tags"
on public.product_tags for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write product tags" on public.product_tags;
create policy "Admins write product tags"
on public.product_tags for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins read import batches" on public.catalog_import_batches;
create policy "Admins read import batches"
on public.catalog_import_batches for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write import batches" on public.catalog_import_batches;
create policy "Admins write import batches"
on public.catalog_import_batches for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins read import rows" on public.catalog_import_rows;
create policy "Admins read import rows"
on public.catalog_import_rows for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins write import rows" on public.catalog_import_rows;
create policy "Admins write import rows"
on public.catalog_import_rows for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- ---------------------------------------------------------
-- Storage: administrators only may write product images.
-- Public read of the product-images bucket is unchanged.
-- ---------------------------------------------------------

drop policy if exists "Admins insert product images" on storage.objects;
create policy "Admins insert product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (select public.is_admin())
);

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (select public.is_admin())
)
with check (
  bucket_id = 'product-images'
  and (select public.is_admin())
);

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (select public.is_admin())
);
