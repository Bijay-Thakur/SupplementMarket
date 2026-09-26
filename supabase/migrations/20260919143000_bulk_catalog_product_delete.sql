-- Delete a reviewed set of catalog products in one transaction. Historical
-- order_items retain their snapshots through the existing ON DELETE SET NULL FK.
create or replace function public.delete_catalog_products(
  p_product_ids uuid[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found_ids uuid[];
  v_deleted integer;
begin
  if p_confirmation is distinct from 'CONFIRM' then
    raise exception using errcode = '22023', message = 'Type CONFIRM to delete these products.';
  end if;
  if p_product_ids is null or cardinality(p_product_ids) < 1 or cardinality(p_product_ids) > 100
     or array_position(p_product_ids, null) is not null then
    raise exception using errcode = '22023', message = 'Select between 1 and 100 products.';
  end if;
  if (select count(distinct id) from unnest(p_product_ids) as selected(id)) <> cardinality(p_product_ids) then
    raise exception using errcode = '22023', message = 'Duplicate product IDs are not allowed.';
  end if;

  select array_agg(locked.id order by locked.id) into v_found_ids
  from (
    select id from public.products where id = any(p_product_ids) for update
  ) as locked;
  if coalesce(cardinality(v_found_ids), 0) <> cardinality(p_product_ids) then
    raise exception using errcode = 'P0002', message = 'One or more products no longer exist; nothing was deleted.';
  end if;

  delete from public.products where id = any(p_product_ids);
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok', true, 'deleted_products', v_deleted, 'product_ids', v_found_ids);
end;
$$;

revoke all on function public.delete_catalog_products(uuid[], text) from public, anon, authenticated;
grant execute on function public.delete_catalog_products(uuid[], text) to service_role;

comment on function public.delete_catalog_products(uuid[], text) is
  'Atomically deletes 1-100 existing catalog products after exact confirmation; order snapshots remain.';

notify pgrst, 'reload schema';
