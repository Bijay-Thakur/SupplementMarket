"""Official manufacturer sources for Phase 2B. Public HTML only."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceDef:
    slug: str
    name: str
    parent_brand: str
    product_line: str | None
    official_url: str
    collection_url: str
    domain: str
    terms_url: str | None
    adapter_key: str
    default_policy: str
    policy_notes: str
    enabled_default: bool = True


SOURCES: tuple[SourceDef, ...] = (
    SourceDef(
        slug="solgar",
        name="Solgar",
        parent_brand="Solgar",
        product_line=None,
        official_url="https://www.solgar.com/",
        collection_url="https://www.solgar.com/",
        domain="www.solgar.com",
        terms_url="https://www.solgar.com/",
        adapter_key="solgar",
        default_policy="blocked",
        policy_notes="robots.txt returned HTTP 403 (bot protection). Collection skipped.",
        enabled_default=False,
    ),
    SourceDef(
        slug="life-extension",
        name="Life Extension",
        parent_brand="Life Extension",
        product_line=None,
        official_url="https://www.lifeextension.com/",
        collection_url="https://www.lifeextension.com/vitamins-supplements/products-a-to-z",
        domain="www.lifeextension.com",
        terms_url="https://www.lifeextension.com/legal",
        adapter_key="life_extension",
        default_policy="blocked",
        policy_notes="robots.txt returned HTTP 403 on later checks. Collection skipped.",
        enabled_default=False,
    ),
    SourceDef(
        slug="natures-way",
        name="Nature's Way",
        parent_brand="Nature's Way",
        product_line=None,
        official_url="https://naturesway.com/",
        collection_url="https://naturesway.com/collections/all-natures-way-products",
        domain="naturesway.com",
        terms_url="https://naturesway.com/policies/terms-of-service",
        adapter_key="natures_way",
        default_policy="permitted",
        policy_notes="Shopify robots: public product/collection HTML crawlable. No cart, checkout, /services, sort_by.",
    ),
    SourceDef(
        slug="twinlab",
        name="Twinlab",
        parent_brand="Twinlab",
        product_line=None,
        official_url="https://twinlab.com/",
        collection_url="https://twinlab.com/shop/",
        domain="twinlab.com",
        terms_url="https://twinlab.com/",
        adapter_key="twinlab",
        default_policy="permitted",
        policy_notes="robots.txt allows public pages; Disallow wp-admin and add-to-cart URLs.",
    ),
    SourceDef(
        slug="now-foods",
        name="NOW Foods",
        parent_brand="NOW Foods",
        product_line=None,
        official_url="https://www.nowfoods.com/",
        collection_url="https://www.nowfoods.com/products/supplements/all-products",
        domain="www.nowfoods.com",
        terms_url="https://www.nowfoods.com/terms-of-use",
        adapter_key="now_foods",
        default_policy="blocked",
        policy_notes="robots.txt Allow:/ but catalog HTML returns HTTP 403 (bot protection). Collection skipped.",
        enabled_default=False,
    ),
    SourceDef(
        slug="garden-of-life",
        name="Garden of Life",
        parent_brand="Garden of Life",
        product_line=None,
        official_url="https://www.gardenoflife.com/",
        collection_url="https://www.gardenoflife.com/products",
        domain="www.gardenoflife.com",
        terms_url="https://www.gardenoflife.com/",
        adapter_key="garden_of_life",
        default_policy="blocked",
        policy_notes="robots.txt returned HTTP 403 (bot protection). Collection skipped.",
        enabled_default=False,
    ),
    SourceDef(
        slug="bluebonnet",
        name="Bluebonnet Nutrition",
        parent_brand="Bluebonnet Nutrition",
        product_line=None,
        official_url="https://bluebonnetnutrition.com/",
        collection_url="https://bluebonnetnutrition.com/collections/all",
        domain="bluebonnetnutrition.com",
        terms_url="https://bluebonnetnutrition.com/policies/terms-of-service",
        adapter_key="bluebonnet",
        default_policy="permitted",
        policy_notes="Shopify robots: public product/collection HTML crawlable.",
    ),
    SourceDef(
        slug="megafood",
        name="MegaFood",
        parent_brand="MegaFood",
        product_line=None,
        official_url="https://megafood.com/",
        collection_url="https://megafood.com/collections/vitamins-and-supplements",
        domain="megafood.com",
        terms_url="https://megafood.com/policies/terms-of-service",
        adapter_key="megafood",
        default_policy="permitted",
        policy_notes="Shopify robots: public product/collection HTML crawlable.",
    ),
    SourceDef(
        slug="maryruths",
        name="MaryRuth's",
        parent_brand="MaryRuth's",
        product_line=None,
        official_url="https://www.maryruthorganics.com/",
        collection_url="https://www.maryruthorganics.com/collections/all",
        domain="www.maryruthorganics.com",
        terms_url="https://www.maryruthorganics.com/policies/terms-of-service",
        adapter_key="maryruths",
        default_policy="permitted",
        policy_notes="Shopify robots: public product/collection HTML crawlable.",
    ),
    SourceDef(
        slug="naturesplus",
        name="NaturesPlus",
        parent_brand="NaturesPlus",
        product_line="Source of Life",
        official_url="https://naturesplus.com/",
        collection_url="https://naturesplus.com/collections/source-of-life",
        domain="naturesplus.com",
        terms_url="https://naturesplus.com/policies/terms-of-service",
        adapter_key="naturesplus",
        default_policy="permitted",
        policy_notes="Shopify robots: public product/collection HTML crawlable. Product line is Source of Life.",
    ),
    SourceDef(
        slug="woodstock-foods",
        name="Woodstock Foods",
        parent_brand="Woodstock Foods",
        product_line=None,
        official_url="https://woodstock-foods.com/",
        collection_url="https://woodstock-foods.com/the-goods.html",
        domain="woodstock-foods.com",
        terms_url="https://woodstock-foods.com/",
        adapter_key="woodstock",
        default_policy="permitted",
        policy_notes="robots.txt allows all user-agents. Natural foods — not dietary supplements.",
    ),
    SourceDef(
        slug="gaia-herbs",
        name="Gaia Herbs",
        parent_brand="Gaia Herbs",
        product_line=None,
        official_url="https://www.gaiaherbs.com/",
        collection_url="https://www.gaiaherbs.com/collections/all",
        domain="www.gaiaherbs.com",
        terms_url="https://www.gaiaherbs.com/policies/terms-of-service",
        adapter_key="gaia_herbs",
        default_policy="permitted",
        policy_notes="Shopify robots: public product/collection HTML crawlable.",
    ),
    SourceDef(
        slug="vital-planet",
        name="Vital Planet",
        parent_brand="Vital Planet",
        product_line=None,
        official_url="https://www.vitalplanet.com/",
        collection_url="https://www.vitalplanet.com/collections/shop-all",
        domain="www.vitalplanet.com",
        terms_url="https://www.vitalplanet.com/policies/terms-of-service",
        adapter_key="vital_planet",
        default_policy="permitted",
        policy_notes="Shopify robots: public product/collection HTML crawlable.",
    ),
)


def source_by_slug(slug: str) -> SourceDef:
    for s in SOURCES:
        if s.slug == slug:
            return s
    raise KeyError(slug)


PARSER_VERSION = "2b.1"
FDA_DISCLAIMER = (
    "These statements have not been evaluated by the Food and Drug Administration. "
    "This product is not intended to diagnose, treat, cure, or prevent any disease."
)
