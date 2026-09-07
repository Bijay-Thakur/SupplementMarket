# Phase 2B — Real-brand demo catalog ingestion

Add a staged, robots-respecting collector and admin review workflow on top of Phase 2. Do not rebuild the storefront, Stripe, or Supabase auth.

## Architecture

1. **CatalogSource** rows describe the 13 official manufacturer sites, policy status, and per-brand limits.
2. **CatalogImportRun** records one collection attempt (stats, robots/terms notes, resume).
3. Adapters fetch **public HTML only** (JSON-LD → embedded product JSON → semantic HTML → brand CSS). No private APIs, no retailer sites.
4. Parsed products land in **CatalogStagedProduct** as `needs_review`. Admin edits, approves, then **Import approved** copies into `products` (inactive unless “Activate after import”).
5. Demo prices are generated deterministically in the backend. Sale price is always `regular × (1 − percent/100)` via `sale_price_from_percent`.

## Policy (inspected 2026-08-31)

| Brand | robots.txt | Initial status |
| --- | --- | --- |
| Solgar | HTTP 403 on robots.txt | **blocked** — skip |
| Garden of Life | HTTP 403 on robots.txt | **blocked** — skip |
| Life Extension | Allow `/` (block `/lpages/`, Sitecore, search) | public product pages |
| NOW Foods | Allow `/`; Content-Signal search=yes, ai-train=no, use=reference | public product pages (reference use) |
| Twinlab | Allow public; Disallow wp-admin / add-to-cart | public product pages |
| Woodstock Foods | Allow all | public catalog page |
| Nature’s Way, Bluebonnet, MegaFood, MaryRuth’s, NaturesPlus, Gaia Herbs, Vital Planet | Shopify: public product/collection HTML crawlable; Disallow cart, checkout, `/services`, `/sf_*`, `sort_by` | public HTML only |

Collector User-Agent: `BronxvilleNaturalMarket-CatalogCollector/1.0`. Optional contact: `CATALOG_COLLECTOR_CONTACT_EMAIL` (never invented). Delay ≥ 1.5s, concurrency 1/domain, retry 429/5xx only.

## Files

- `frontend/backend/app/catalog/` — HTTP, robots, extractors, pricing, images, pipeline, CLI, adapters
- `frontend/backend/app/api/routes_catalog_imports.py` — dev-only admin API
- `/admin/catalog-imports*` — review UI
- Alembic migration for staging tables + product provenance columns

## Out of scope

Stripe, Supabase auth, production publishing, Amazon/Walmart/Google Shopping, fabricating products for skipped brands.
