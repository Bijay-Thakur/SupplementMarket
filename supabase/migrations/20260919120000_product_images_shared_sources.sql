-- Package variants may legitimately use the same manufacturer-hosted photo.
-- Keep duplicate image entries off a single product, but allow the source URL
-- to be referenced by multiple products.
alter table public.product_images
  drop constraint if exists product_images_storage_path_key;

create unique index if not exists product_images_product_storage_path_unique
  on public.product_images (product_id, storage_path);
