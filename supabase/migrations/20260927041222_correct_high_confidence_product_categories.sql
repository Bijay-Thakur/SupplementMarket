-- Vendor category labels are inconsistent and sometimes place clear single-purpose
-- products in unrelated merchandising sections. Keep this correction deliberately
-- narrow so ambiguous products remain available for manual taxonomy review.
do $$
declare
  v_herbs_id uuid;
  v_sexual_wellness_id uuid;
begin
  insert into public.categories (name, slug, description, is_active)
  values (
    'Herbs',
    'herbs',
    'Herbs, botanical extracts, and traditional plant-based supplements.',
    true
  )
  on conflict (slug) do update
    set name = excluded.name,
        description = coalesce(public.categories.description, excluded.description),
        is_active = true
  returning id into v_herbs_id;

  insert into public.categories (name, slug, description, is_active)
  values (
    'Sexual Wellness',
    'sexual-wellness',
    'Products formulated to support sexual health, libido, and healthy testosterone levels.',
    true
  )
  on conflict (slug) do update
    set name = excluded.name,
        description = coalesce(public.categories.description, excluded.description),
        is_active = true
  returning id into v_sexual_wellness_id;

  update public.products
  set category_id = v_herbs_id
  where name ~* '(^|[^a-z0-9])ashwagandha([^a-z0-9]|$)'
    and category_id is distinct from v_herbs_id;

  update public.products
  set category_id = v_sexual_wellness_id
  where name ~* '(^|[^a-z0-9])(testosterone|libido|tribulus|t[ -]?male|ght[ -]?male|male enhancement|sexual (response|wellness|health)|erectile|horny goat weed|yohimbe|male response|female response)([^a-z0-9]|$)'
    and category_id is distinct from v_sexual_wellness_id;
end;
$$;
