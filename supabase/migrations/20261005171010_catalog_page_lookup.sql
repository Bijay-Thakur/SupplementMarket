-- Returns only IDs/count for ordinary browsing. Search keeps its existing
-- synonym/ranking implementation. No writes or schema changes to catalog data.
create function public.catalog_browse_page(filters jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with eligible as (
    select p.id, p.name, p.created_at, p.is_best_seller, p.is_featured,
           coalesce(v.availability, 'in_stock') as availability
    from public.products p
    left join public.brands b on b.id = p.brand_id
    left join public.categories c on c.id = p.category_id
    left join lateral (
      select pv.availability, pv.regular_price_cents, pv.sale_price_cents
      from public.product_variants pv where pv.product_id = p.id
      order by pv.is_default desc, pv.id limit 1
    ) v on true
    where p.status = 'active'
      and (nullif(filters->>'brand','') is null or b.slug = filters->>'brand')
      and (nullif(filters->>'category','') is null or c.slug = filters->>'category')
      and (filters->>'featured' is null or p.is_featured = (filters->>'featured')::boolean)
      and (filters->>'bestseller' is null or p.is_best_seller = (filters->>'bestseller')::boolean)
      and (filters->>'is_new' is null or p.is_new = (filters->>'is_new')::boolean)
      and (filters->>'on_sale' is null or coalesce(v.sale_price_cents < v.regular_price_cents, false) = (filters->>'on_sale')::boolean)
  ), page_rows as (
    select id, row_number() over (order by
      case when filters->>'sort' = 'newest' then created_at end desc,
      case when coalesce(filters->>'sort','relevance') not in ('newest','name_asc') then case when availability = 'in_stock' then 0 else 1 end end,
      case when coalesce(filters->>'sort','relevance') not in ('newest','name_asc') then is_best_seller end desc,
      case when coalesce(filters->>'sort','relevance') not in ('newest','name_asc') then is_featured end desc,
      name, id) as position
    from eligible
  )
  select jsonb_build_object(
    'total', (select count(*) from eligible),
    'ids', coalesce((select jsonb_agg(id order by position) from (
      select id, position from page_rows order by position
      limit greatest(1, least(coalesce((filters->>'page_size')::int,24),100))
      offset (greatest(1,coalesce((filters->>'page')::int,1))-1) * greatest(1,least(coalesce((filters->>'page_size')::int,24),100))
    ) chosen), '[]'::jsonb)
  );
$$;
revoke all on function public.catalog_browse_page(jsonb) from public, anon, authenticated;
grant execute on function public.catalog_browse_page(jsonb) to service_role;
