-- Storefront brand cards use locally bundled, reviewed logo artwork so that
-- customer browsing does not depend on expiring or hot-linked image URLs.
update public.brands as brand
set
  logo_path = source.logo_path,
  website_url = source.website_url,
  updated_at = now()
from (
  values
    ('biosil', '/brand-logos/biosil.png', 'https://www.mybiosil.com/'),
    ('dynamic-health', '/brand-logos/dynamic-health.png', 'https://dynamichealth.com/'),
    ('emerita', '/brand-logos/emerita.jpg', 'https://life-flo.com/collections/emerita'),
    ('garden-of-life', '/brand-logos/garden-of-life.png', 'https://www.gardenoflife.com/'),
    ('herbs-for-kids', '/brand-logos/herbs-for-kids.png', 'https://brandfolder.com/betterbeingco/herbs-for-kids'),
    ('heritage-store', '/brand-logos/heritage-store.png', 'https://heritagestore.com/'),
    ('honey-gardens', '/brand-logos/honey-gardens.png', 'https://brandfolder.com/betterbeingco/honey-gardens'),
    ('kal', '/brand-logos/kal.png', 'https://www.kalvitamins.com/'),
    ('lifeflo', '/brand-logos/lifeflo.png', 'https://life-flo.com/'),
    ('lifetime', '/brand-logos/lifetime.png', 'https://lifetimevitamins.com/'),
    ('natures-life', '/brand-logos/natures-life.svg', 'https://natureslife.com/'),
    ('naturesplus', '/brand-logos/naturesplus.svg', 'https://naturesplus.com/'),
    ('organix-south', '/brand-logos/organix-south.png', 'https://theraneem.com/'),
    ('rainbow-light', '/brand-logos/rainbow-light.png', 'https://www.rainbowlight.com/'),
    ('real-aloe', '/brand-logos/real-aloe.png', 'https://realaloe.com/'),
    ('renew-life', '/brand-logos/renew-life.svg', 'https://www.renewlife.com/'),
    ('reserveage-nutrition', '/brand-logos/reserveage-nutrition.svg', 'https://www.reserveage.com/'),
    ('solaray', '/brand-logos/solaray.png', 'https://solaray.com/'),
    ('zand', '/brand-logos/zand.png', 'https://www.zandimmunity.com/'),
    ('zhou-nutrition', '/brand-logos/zhou-nutrition.png', 'https://www.zhounutrition.com/')
) as source(slug, logo_path, website_url)
where brand.slug = source.slug;

notify pgrst, 'reload schema';
