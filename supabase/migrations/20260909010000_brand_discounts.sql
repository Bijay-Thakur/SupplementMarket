-- A brand discount is the pricing rule for every variant sold under that brand.
-- NULL preserves existing per-product pricing until an administrator chooses a rule.
-- 0 explicitly removes Store SRP sale pricing; 1..99 derives Store SRP from MSRP.
alter table public.brands
  add column discount_percent integer
  check (discount_percent is null or discount_percent between 0 and 99);

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
    new.sale_price_cents := case
      when brand_discount = 0 or new.regular_price_cents = 0 then null
      else least(
        new.regular_price_cents - 1,
        round(new.regular_price_cents * (100 - brand_discount) / 100.0)::integer
      )
    end;
  end if;

  return new;
end;
$$;

create trigger product_variants_apply_brand_discount
before insert or update of product_id, regular_price_cents, sale_price_cents
on public.product_variants
for each row execute function public.apply_brand_discount_to_variant();

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
  set sale_price_cents = case
        when new.discount_percent = 0 or v.regular_price_cents = 0 then null
        else least(
          v.regular_price_cents - 1,
          round(v.regular_price_cents * (100 - new.discount_percent) / 100.0)::integer
        )
      end,
      updated_at = now()
  from public.products p
  where p.id = v.product_id
    and p.brand_id = new.id;

  return null;
end;
$$;

create trigger brands_sync_discount_prices
after update of discount_percent on public.brands
for each row
when (old.discount_percent is distinct from new.discount_percent)
execute function public.sync_brand_discount_prices();

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
  set sale_price_cents = case
        when brand_discount = 0 or regular_price_cents = 0 then null
        else least(
          regular_price_cents - 1,
          round(regular_price_cents * (100 - brand_discount) / 100.0)::integer
        )
      end,
      updated_at = now()
  where product_id = new.id;

  return null;
end;
$$;

create trigger products_sync_brand_discount_prices
after update of brand_id on public.products
for each row
when (old.brand_id is distinct from new.brand_id)
execute function public.sync_product_brand_discount_prices();
