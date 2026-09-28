-- Consolidate fragmented gender- and reproductive-health merchandising into one
-- customer-facing category while preserving the existing Sexual Wellness row ID.
do $$
declare
  v_target_id uuid;
begin
  update public.categories
  set name = 'Men & Women Health',
      slug = 'men-women-health',
      description = 'Supplements supporting women''s and men''s wellness, including menstrual, menopause, prenatal, prostate, hormone, fertility, libido, and sexual health needs.',
      is_active = true,
      updated_at = now()
  where slug = 'sexual-wellness'
  returning id into v_target_id;

  if v_target_id is null then
    insert into public.categories (name, slug, description, is_active)
    values (
      'Men & Women Health',
      'men-women-health',
      'Supplements supporting women''s and men''s wellness, including menstrual, menopause, prenatal, prostate, hormone, fertility, libido, and sexual health needs.',
      true
    )
    on conflict (slug) do update
      set name = excluded.name,
          description = excluded.description,
          is_active = true,
          updated_at = now()
    returning id into v_target_id;
  end if;

  update public.products as product
  set category_id = v_target_id,
      updated_at = now()
  where product.category_id in (
      select category.id
      from public.categories as category
      where category.slug in (
        'men', 'men-s-health', 'men-s-multis', 'men-s-wellness',
        'women', 'women-s', 'women-s-formulas', 'women-s-health',
        'women-s-health-hormone-creams', 'women-s-multis', 'women-s-wellness',
        'prenatal-postnatal', 'baby-me-2'
      )
    )
    or concat_ws(
      ' ',
      product.name,
      product.short_description,
      product.description,
      array_to_string(coalesce(product.search_aliases, '{}'::text[]), ' ')
    ) ~* '(^|[^a-z0-9])(menstru|menopause|perimenopause|postmenopause|pms([^a-z0-9]|$)|pmdd|hot flash|prostate|saw palmetto|estrogen|oestrogen|progesterone|hormone (balance|support)|hormonal|testoster|libido|sexual|erectile|fertility|reproductive|prenatal|postnatal|pregnan|vaginal|uterine|ovarian|ovulat|endometri|breast health|male enhancement|female response|male response|intimate essentials|t[ -]?male|ght[ -]?male|tribulus|horny goat|yohimbe|black cohosh|dong quai|wild yam|chaste tree|vitex|dhea)([^a-z0-9]|$)'
    or concat_ws(' ', product.name, product.short_description) ~* '(^|[^a-z0-9])(women(''s|s)?|men(''s|s)?)[ -]+(health|wellness|multi|multivitamin|formula|probiotic|daily|one)([^a-z0-9]|$)';

  update public.categories as category
  set is_active = false,
      updated_at = now()
  where category.id <> v_target_id
    and category.slug in (
      'men', 'men-s-health', 'men-s-multis', 'men-s-wellness',
      'women', 'women-s', 'women-s-formulas', 'women-s-health',
      'women-s-health-hormone-creams', 'women-s-multis', 'women-s-wellness',
      'prenatal-postnatal', 'baby-me-2'
    );
end;
$$;

notify pgrst, 'reload schema';
