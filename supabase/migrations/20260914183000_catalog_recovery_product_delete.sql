-- Recover catalog imports abandoned by a terminated serverless request and
-- provide a narrowly-scoped, service-role-only permanent product deletion.

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
  v_started_at timestamptz;
  v_created_at timestamptz;
  v_deleted_products integer := 0;
  v_retained_updates integer := 0;
  v_recovered_stale_processing boolean := false;
begin
  if p_confirmation is distinct from 'CONFIRM' then
    raise exception using errcode = '22023', message = 'Type CONFIRM to delete this import.';
  end if;

  select status, started_at, created_at
  into v_status, v_started_at, v_created_at
  from public.catalog_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Import batch not found.';
  end if;

  -- A Vercel function cannot keep working after its request is terminated. A
  -- processing batch with no activity for five minutes is therefore an
  -- abandoned lease and may be safely removed. Recent work remains protected.
  if v_status = 'processing'
     and coalesce(v_started_at, v_created_at, now()) > now() - interval '5 minutes' then
    raise exception using
      errcode = '55006',
      message = 'This import is still active. Wait five minutes before recovering it.';
  end if;
  v_recovered_stale_processing := v_status = 'processing';

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
    'retained_updated_products', v_retained_updates,
    'recovered_stale_processing', v_recovered_stale_processing
  );
end;
$$;

revoke all on function public.delete_catalog_import(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_catalog_import(uuid, text)
  to service_role;

comment on function public.delete_catalog_import(uuid, text) is
  'Deletes a catalog import after exact confirmation; a processing lease must be at least five minutes old.';

-- Historical order rows retain their product snapshot when a catalog product
-- is removed. Re-applying this FK also repairs older installations that used
-- the default restrictive delete behavior.
alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;
alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

create or replace function public.delete_catalog_product(
  p_product_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_product_name text;
begin
  if p_confirmation is distinct from 'CONFIRM' then
    raise exception using errcode = '22023', message = 'Type CONFIRM to delete this product.';
  end if;

  select name into v_product_name
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product not found.';
  end if;

  delete from public.products where id = p_product_id;

  return jsonb_build_object(
    'ok', true,
    'product_id', p_product_id,
    'product_name', v_product_name
  );
end;
$$;

revoke all on function public.delete_catalog_product(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_catalog_product(uuid, text)
  to service_role;

comment on function public.delete_catalog_product(uuid, text) is
  'Permanently deletes one product after exact confirmation; order item snapshots are retained.';

notify pgrst, 'reload schema';
