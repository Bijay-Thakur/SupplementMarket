-- Replace product/promotional imagery and an icon-only mark with complete,
-- locally bundled wordmarks for the storefront brand directory.
update public.brands as brand
set logo_path = source.logo_path,
    updated_at = now()
from (
  values
    ('plushlth', '/brand-logos/plushlth.svg'),
    ('home-health', '/brand-logos/home-health.svg'),
    ('american-health', '/brand-logos/american-health.svg')
) as source(slug, logo_path)
where brand.slug = source.slug;

notify pgrst, 'reload schema';
