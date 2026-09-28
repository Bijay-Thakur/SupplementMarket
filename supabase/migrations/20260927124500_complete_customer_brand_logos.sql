-- Complete the storefront brand directory with locally bundled, reviewed
-- artwork. Local paths keep the customer experience independent of hotlinks.
update public.brands as brand
set
  logo_path = source.logo_path,
  website_url = source.website_url,
  updated_at = now()
from (
  values
    ('pluscbd', '/brand-logos/pluscbd.png', 'https://www.pluscbdoil.com/'),
    ('plushlth', '/brand-logos/plushlth.jpg', 'https://www.pluscbdoil.com/plushlth.html'),
    ('american-health', '/brand-logos/american-health.png', 'https://www.americanhealthus.com/'),
    ('betteralt', '/brand-logos/betteralt.png', 'https://thebetteralt.com/'),
    ('bionutrition', '/brand-logos/bionutrition.png', 'https://bionutritioninc.com/'),
    ('bluebonnet-nutrition', '/brand-logos/bluebonnet-nutrition.png', 'https://bluebonnetnutrition.com/'),
    ('boiron', '/brand-logos/boiron.webp', 'https://www.boironusa.com/'),
    ('charlottes-web', '/brand-logos/charlottes-web.svg', 'https://www.charlottesweb.com/'),
    ('childlife', '/brand-logos/childlife.png', 'https://childlifenutrition.com/'),
    ('enzymedica', '/brand-logos/enzymedica.png', 'https://enzymedica.com/'),
    ('forces-of-nature', '/brand-logos/forces-of-nature.png', 'https://forcesofnaturemedicine.com/'),
    ('gaia-herbs', '/brand-logos/gaia-herbs.png', 'https://www.gaiaherbs.com/'),
    ('home-health', '/brand-logos/home-health.jpg', 'https://www.homehealthus.com/'),
    ('hylands', '/brand-logos/hylands.svg', 'https://hylands.com/'),
    ('jarrow-formulas', '/brand-logos/jarrow-formulas.png', 'https://jarrow.com/'),
    ('kyolic', '/brand-logos/kyolic.png', 'https://kyolic.com/'),
    ('lily-of-the-desert', '/brand-logos/lily-of-the-desert.png', 'https://lilyofthedesert.com/'),
    ('megafood', '/brand-logos/megafood.svg', 'https://megafood.com/'),
    ('natrol', '/brand-logos/natrol.svg', 'https://www.natrol.com/'),
    ('natural-vitality', '/brand-logos/natural-vitality.svg', 'https://www.naturalvitality.com/'),
    ('natures-way', '/brand-logos/natures-way.png', 'https://naturesway.com/'),
    ('nelson-bach', '/brand-logos/nelson-bach.svg', 'https://www.nelsons.com/en-us/'),
    ('north-american', '/brand-logos/north-american.png', 'https://www.northamericanherbandspice.com/'),
    ('om-mushrooms', '/brand-logos/om-mushrooms.png', 'https://ommushrooms.com/'),
    ('organic-india', '/brand-logos/organic-india.svg', 'https://www.organicindiausa.com/'),
    ('pacific-resources', '/brand-logos/pacific-resources.png', 'https://www.shoppri.com/'),
    ('solgar', '/brand-logos/solgar.png', 'https://www.solgar.com/'),
    ('vital-planet', '/brand-logos/vital-planet.png', 'https://www.vitalplanet.com/'),
    ('yerba-prima', '/brand-logos/yerba-prima.png', 'https://yerba.com/'),
    ('youtheory', '/brand-logos/youtheory.png', 'https://www.youtheory.com/')
) as source(slug, logo_path, website_url)
where brand.slug = source.slug;

notify pgrst, 'reload schema';
