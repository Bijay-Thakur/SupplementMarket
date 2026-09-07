create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  website_url text,
  logo_path text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index brands_name_ci_unique
  on public.brands (lower(name));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  image_path text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  category_id uuid references public.categories(id) on delete set null,

  name text not null,
  slug text not null unique,
  product_line text,

  short_description text,
  description text,
  suggested_use text,
  warnings text,
  supplement_facts jsonb,

  search_aliases text[] not null default '{}',

  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),

  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_new boolean not null default false,

  source_url text,
  data_source text,
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_brand_id_idx
  on public.products(brand_id);

create index products_category_id_idx
  on public.products(category_id);

create index products_status_idx
  on public.products(status);

create index products_name_search_idx
  on public.products using gin (name gin_trgm_ops);

create index products_aliases_idx
  on public.products using gin (search_aliases);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products(id) on delete cascade,

  label text,
  sku text,
  upc text,

  form text check (
    form is null or form in (
      'capsule',
      'tablet',
      'softgel',
      'liquid',
      'powder',
      'gummy',
      'lozenge',
      'spray',
      'packet',
      'other'
    )
  ),

  strength_value numeric,
  strength_unit text,
  size_value numeric,
  size_unit text,
  unit_count integer,
  flavor text,

  regular_price_cents integer not null
    check (regular_price_cents >= 0),

  sale_price_cents integer check (
    sale_price_cents is null or (
      sale_price_cents >= 0
      and sale_price_cents < regular_price_cents
    )
  ),

  sale_starts_at timestamptz,
  sale_ends_at timestamptz,

  availability text not null default 'in_stock'
    check (
      availability in (
        'in_stock',
        'low_stock',
        'out_of_stock',
        'special_order',
        'discontinued'
      )
    ),

  is_default boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_variants_sku_unique
  on public.product_variants(sku)
  where sku is not null;

create unique index product_variants_upc_unique
  on public.product_variants(upc)
  where upc is not null;

create unique index one_default_variant_per_product
  on public.product_variants(product_id)
  where is_default = true;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products(id) on delete cascade,

  storage_path text not null unique,
  alt_text text,
  is_primary boolean not null default false,
  display_order integer not null default 0,

  source_url text,
  usage_verified boolean not null default false,

  created_at timestamptz not null default now()
);

create unique index one_primary_image_per_product
  on public.product_images(product_id)
  where is_primary = true;

create table public.product_tags (
  product_id uuid not null
    references public.products(id) on delete cascade,

  tag_type text not null check (
    tag_type in (
      'health_goal',
      'dietary',
      'ingredient',
      'vitamin',
      'certification',
      'free_from',
      'search_alias'
    )
  ),

  tag text not null,
  primary key (product_id, tag_type, tag)
);

create index product_tags_lookup_idx
  on public.product_tags(tag_type, tag);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.product_tags enable row level security;

revoke all on public.brands from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_variants from anon, authenticated;
revoke all on public.product_images from anon, authenticated;
revoke all on public.product_tags from anon, authenticated;

grant select on public.brands to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.product_tags to anon, authenticated;

create policy "Public can read active brands"
on public.brands for select
to anon, authenticated
using (is_active = true);

create policy "Public can read active categories"
on public.categories for select
to anon, authenticated
using (is_active = true);

create policy "Public can read active products"
on public.products for select
to anon, authenticated
using (status = 'active');

create policy "Public can read variants of active products"
on public.product_variants for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'active'
  )
);

create policy "Public can read images of active products"
on public.product_images for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'active'
  )
);

create policy "Public can read tags of active products"
on public.product_tags for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'active'
  )
);

insert into public.brands (name, slug)
values
  ('Solgar', 'solgar'),
  ('Life Extension', 'life-extension'),
  ('Nature''s Way', 'natures-way'),
  ('Twinlab', 'twinlab'),
  ('NOW Foods', 'now-foods'),
  ('Garden of Life', 'garden-of-life'),
  ('Bluebonnet Nutrition', 'bluebonnet-nutrition'),
  ('MegaFood', 'megafood'),
  ('MaryRuth''s', 'maryruths'),
  ('Source of Life', 'source-of-life'),
  ('Woodstock', 'woodstock'),
  ('Gaia Herbs', 'gaia-herbs'),
  ('Vital Planet', 'vital-planet')
on conflict (slug) do nothing;