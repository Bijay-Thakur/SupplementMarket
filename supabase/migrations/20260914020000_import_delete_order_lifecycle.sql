-- Production-safe import deletion, durable customer addresses, and the
-- call-to-confirm order lifecycle. Privileged operations remain server-only.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'US',
  delivery_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_addresses_one_default
  on public.customer_addresses (user_id) where is_default;

alter table public.customer_addresses drop constraint if exists customer_addresses_content_check;
alter table public.customer_addresses
  add constraint customer_addresses_content_check check (
    length(trim(recipient_name)) between 2 and 160
    and length(trim(address_line1)) between 2 and 240
    and length(trim(city)) between 2 and 120
    and length(trim(state)) between 2 and 40
    and length(trim(postal_code)) between 3 and 20
    and country_code ~ '^[A-Z]{2}$'
  );

drop trigger if exists customer_addresses_set_updated_at on public.customer_addresses;
create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from public, anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to service_role;

alter table public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists admin_seen_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (
    status in (
      'placed',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'shipped',
      'out_for_delivery',
      'delivered',
      'completed',
      'cancelled'
    )
  );

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'paid'));

alter table public.orders drop constraint if exists orders_fulfillment_status_check;
alter table public.orders
  add constraint orders_fulfillment_status_check check (
    (fulfillment_type = 'pickup' and status not in ('shipped', 'out_for_delivery', 'delivered'))
    or (fulfillment_type = 'delivery' and status <> 'ready_for_pickup')
  );

create index if not exists orders_admin_unseen_idx
  on public.orders (created_at desc) where admin_seen_at is null;

create or replace function public.delete_catalog_import(
  p_batch_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_deleted_products integer := 0;
  v_retained_updates integer := 0;
begin
  if p_confirmation is distinct from 'CONFIRM' then
    raise exception using errcode = '22023', message = 'Type CONFIRM to delete this import.';
  end if;

  select status into v_status
  from public.catalog_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Import batch not found.';
  end if;
  if v_status = 'processing' then
    raise exception using errcode = '55006', message = 'An import cannot be deleted while it is processing.';
  end if;

  select count(*) into v_retained_updates
  from public.catalog_import_rows
  where batch_id = p_batch_id
    and detected_action in ('update', 'unchanged')
    and committed_product_id is not null;

  delete from public.products as product
  using (
    select distinct committed_product_id
    from public.catalog_import_rows
    where batch_id = p_batch_id
      and detected_action = 'insert'
      and committed_product_id is not null
  ) as imported
  where product.id = imported.committed_product_id
    and product.data_source = 'csv_import';

  get diagnostics v_deleted_products = row_count;

  delete from public.catalog_import_batches where id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'deleted_products', v_deleted_products,
    'retained_updated_products', v_retained_updates
  );
end;
$$;

revoke all on function public.delete_catalog_import(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_catalog_import(uuid, text)
  to service_role;

comment on function public.delete_catalog_import(uuid, text) is
  'Deletes an import batch and products created by it after exact typed confirmation; pre-existing updated products are retained.';

-- Re-apply the order function in case the original order migration was run
-- before pickup addresses became optional.
create or replace function public.submit_order_request(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_fulfillment_type text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address_line1 text,
  p_delivery_address_line2 text,
  p_delivery_city text,
  p_delivery_state text,
  p_delivery_zip text,
  p_delivery_instructions text,
  p_items jsonb
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing_id bigint;
  v_order_id bigint;
  v_customer_email text;
  v_item jsonb;
  v_line jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product_name text;
  v_brand_name text;
  v_sku text;
  v_availability text;
  v_regular_price integer;
  v_sale_price integer;
  v_sale_starts_at timestamptz;
  v_sale_ends_at timestamptz;
  v_unit_price integer;
  v_subtotal bigint := 0;
  v_lines jsonb := '[]'::jsonb;
  v_has_duplicates boolean;
begin
  select email into v_customer_email
  from auth.users
  where id = p_user_id;

  if v_customer_email is null then
    raise exception using errcode = '22023', message = 'A verified customer account is required.';
  end if;

  select id into v_existing_id
  from public.orders
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if p_fulfillment_type not in ('pickup', 'delivery') then
    raise exception using errcode = '22023', message = 'Choose store pickup or local delivery.';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'Customer name is required.';
  end if;
  if length(trim(coalesce(p_customer_phone, ''))) not between 5 and 40 then
    raise exception using errcode = '22023', message = 'A valid phone number is required.';
  end if;
  if p_fulfillment_type = 'delivery' and (
     length(trim(coalesce(p_delivery_address_line1, ''))) not between 2 and 240
     or length(trim(coalesce(p_delivery_city, ''))) not between 2 and 120
     or length(trim(coalesce(p_delivery_state, ''))) not between 2 and 40
     or length(trim(coalesce(p_delivery_zip, ''))) not between 3 and 20
  ) then
    raise exception using errcode = '22023', message = 'A complete address is required.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception using errcode = '22023', message = 'The cart must contain between 1 and 50 products.';
  end if;

  select count(*) <> count(distinct item.value ->> 'product_id')
  into v_has_duplicates
  from jsonb_array_elements(p_items) as item(value);
  if v_has_duplicates then
    raise exception using errcode = '22023', message = 'The cart contains a duplicate product.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as item(value)
  loop
    if coalesce(v_item ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
       or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'A cart item is invalid.';
    end if;

    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 99 then
      raise exception using errcode = '22023', message = 'Product quantities must be between 1 and 99.';
    end if;

    select
      p.name,
      b.name,
      variant.sku,
      variant.availability,
      variant.regular_price_cents,
      variant.sale_price_cents,
      variant.sale_starts_at,
      variant.sale_ends_at
    into
      v_product_name,
      v_brand_name,
      v_sku,
      v_availability,
      v_regular_price,
      v_sale_price,
      v_sale_starts_at,
      v_sale_ends_at
    from public.products p
    join public.brands b on b.id = p.brand_id
    join lateral (
      select pv.*
      from public.product_variants pv
      where pv.product_id = p.id and pv.is_active = true
      order by pv.is_default desc, pv.display_order asc, pv.created_at asc
      limit 1
    ) as variant on true
    where p.id = v_product_id and p.status = 'active';

    if not found then
      raise exception using errcode = '22023', message = 'A product in the cart is no longer available.';
    end if;
    if v_availability not in ('in_stock', 'low_stock', 'special_order') then
      raise exception using errcode = '22023', message = format('%s is not currently available to order.', v_product_name);
    end if;

    v_unit_price := case
      when v_sale_price is not null
       and v_sale_price < v_regular_price
       and (v_sale_starts_at is null or v_sale_starts_at <= now())
       and (v_sale_ends_at is null or v_sale_ends_at > now())
      then v_sale_price
      else v_regular_price
    end;
    v_subtotal := v_subtotal + (v_unit_price::bigint * v_quantity);
    if v_subtotal > 2147483647 then
      raise exception using errcode = '22023', message = 'The order total is too large.';
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'brand_name', v_brand_name,
      'sku', v_sku,
      'unit_price_cents', v_unit_price,
      'quantity', v_quantity,
      'line_total_cents', v_unit_price * v_quantity
    ));
  end loop;

  insert into public.orders (
    order_number,
    user_id,
    fulfillment_type,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address_line1,
    delivery_address_line2,
    delivery_city,
    delivery_state,
    delivery_zip,
    delivery_instructions,
    subtotal_cents,
    total_cents,
    idempotency_key
  ) values (
    'PENDING-' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    p_fulfillment_type,
    trim(p_customer_name),
    lower(v_customer_email),
    trim(p_customer_phone),
    nullif(trim(p_delivery_address_line1), ''),
    nullif(trim(p_delivery_address_line2), ''),
    nullif(trim(p_delivery_city), ''),
    nullif(trim(p_delivery_state), ''),
    nullif(trim(p_delivery_zip), ''),
    nullif(trim(p_delivery_instructions), ''),
    v_subtotal::integer,
    v_subtotal::integer,
    p_idempotency_key
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select id into v_order_id
    from public.orders
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    return v_order_id;
  end if;

  update public.orders
  set order_number = 'BNM-' || to_char(current_date, 'YYMMDD') || '-' || lpad(v_order_id::text, 6, '0')
  where id = v_order_id;

  for v_line in select value from jsonb_array_elements(v_lines) as line(value)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      brand_name,
      sku,
      unit_price_cents,
      quantity,
      line_total_cents
    ) values (
      v_order_id,
      (v_line ->> 'product_id')::uuid,
      v_line ->> 'product_name',
      nullif(v_line ->> 'brand_name', ''),
      nullif(v_line ->> 'sku', ''),
      (v_line ->> 'unit_price_cents')::integer,
      (v_line ->> 'quantity')::integer,
      (v_line ->> 'line_total_cents')::integer
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.submit_order_request(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.submit_order_request(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

comment on function public.submit_order_request(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) is 'Atomically creates an unpaid call-to-confirm order request using current database prices.';

notify pgrst, 'reload schema';
