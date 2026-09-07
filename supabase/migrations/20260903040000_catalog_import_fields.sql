create extension if not exists pgcrypto;

-- Incremental catalog fields for CSV import and private wholesale cost.
alter table public.product_variants
  add column if not exists supplier_sku text,
  add column if not exists cost_price_cents integer,
  add column if not exists source_name text,
  add column if not exists source_row_hash text;

alter table public.product_variants
  drop constraint if exists product_variants_cost_price_cents_check;

alter table public.product_variants
  add constraint product_variants_cost_price_cents_check
  check (cost_price_cents is null or cost_price_cents >= 0);

create unique index if not exists product_variants_source_supplier_sku_unique
  on public.product_variants (source_name, supplier_sku)
  where supplier_sku is not null;

-- Wholesale cost is never granted to public roles (column-level).
revoke all on public.product_variants from anon, authenticated;
grant select (
  id,
  product_id,
  label,
  sku,
  upc,
  supplier_sku,
  form,
  strength_value,
  strength_unit,
  size_value,
  size_unit,
  unit_count,
  flavor,
  regular_price_cents,
  sale_price_cents,
  sale_starts_at,
  sale_ends_at,
  availability,
  is_default,
  is_active,
  display_order,
  source_name,
  source_row_hash,
  created_at,
  updated_at
) on public.product_variants to anon, authenticated;

create table if not exists public.catalog_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_sha256 text not null,
  source_brand_id uuid references public.brands(id) on delete set null,
  status text not null default 'uploaded'
    check (status in (
      'uploaded',
      'parsed',
      'awaiting_confirmation',
      'processing',
      'completed',
      'partially_completed',
      'failed'
    )),
  default_discount_percent integer
    check (
      default_discount_percent is null
      or default_discount_percent in (0, 10, 20, 30, 40)
    ),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  unchanged_rows integer not null default 0,
  skipped_rows integer not null default 0,
  force_reprocess boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists catalog_import_batches_sha_idx
  on public.catalog_import_batches (file_sha256, created_at desc);

create table if not exists public.catalog_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.catalog_import_batches(id) on delete cascade,
  source_row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  detected_action text not null
    check (detected_action in ('insert', 'update', 'unchanged', 'skip', 'error')),
  validation_errors jsonb not null default '[]'::jsonb,
  validation_warnings jsonb not null default '[]'::jsonb,
  committed_product_id uuid references public.products(id) on delete set null,
  committed_variant_id uuid references public.product_variants(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists catalog_import_rows_batch_idx
  on public.catalog_import_rows (batch_id, source_row_number);

alter table public.catalog_import_batches enable row level security;
alter table public.catalog_import_rows enable row level security;

revoke all on public.catalog_import_batches from anon, authenticated;
revoke all on public.catalog_import_rows from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');
