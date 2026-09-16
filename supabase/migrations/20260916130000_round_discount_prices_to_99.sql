-- Discount-derived Store SRP prices always end in .99. A computed price with
-- cents below 50 moves to the previous dollar's .99; 50 or more moves to the
-- current dollar's .99. Explicitly entered sale prices remain unchanged.

create or replace function public.round_store_price_to_99(p_price_cents integer)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select greatest(
    0,
    case
      when mod(p_price_cents, 100) < 50
        then (p_price_cents / 100) * 100 - 1
      else (p_price_cents / 100) * 100 + 99
    end
  );
$$;

create or replace function public.brand_discount_sale_price(
  p_regular_price_cents integer,
  p_discount_percent integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_discount_percent = 0 or p_regular_price_cents = 0 then null
    else least(
      public.round_store_price_to_99(
        round(p_regular_price_cents * (100 - p_discount_percent) / 100.0)::integer
      ),
      greatest(
        0,
        floor((p_regular_price_cents - 100) / 100.0)::integer * 100 + 99
      )
    )
  end;
$$;

create or replace function public.apply_brand_discount_to_variant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  brand_discount integer;
begin
  select b.discount_percent
    into brand_discount
  from public.products p
  join public.brands b on b.id = p.brand_id
  where p.id = new.product_id;

  if brand_discount is not null then
    new.sale_price_cents := public.brand_discount_sale_price(
      new.regular_price_cents,
      brand_discount
    );
  end if;

  return new;
end;
$$;

create or replace function public.sync_brand_discount_prices()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.discount_percent is null then
    return null;
  end if;

  update public.product_variants v
  set sale_price_cents = public.brand_discount_sale_price(
        v.regular_price_cents,
        new.discount_percent
      ),
      updated_at = now()
  from public.products p
  where p.id = v.product_id
    and p.brand_id = new.id;

  return null;
end;
$$;

create or replace function public.sync_product_brand_discount_prices()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  brand_discount integer;
begin
  select discount_percent
    into brand_discount
  from public.brands
  where id = new.brand_id;

  if brand_discount is null then
    return null;
  end if;

  update public.product_variants
  set sale_price_cents = public.brand_discount_sale_price(
        regular_price_cents,
        brand_discount
      ),
      updated_at = now()
  where product_id = new.id;

  return null;
end;
$$;

-- Recalculate existing brand-managed prices immediately on deployment.
update public.product_variants v
set sale_price_cents = public.brand_discount_sale_price(
      v.regular_price_cents,
      b.discount_percent
    ),
    updated_at = now()
from public.products p
join public.brands b on b.id = p.brand_id
where p.id = v.product_id
  and b.discount_percent is not null;

comment on function public.round_store_price_to_99(integer) is
  'Rounds a computed cents value to the configured 99-cent store-price ending.';

comment on function public.brand_discount_sale_price(integer, integer) is
  'Calculates a brand-discount Store SRP with a 99-cent ending below MSRP.';

notify pgrst, 'reload schema';
