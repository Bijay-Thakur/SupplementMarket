# Phase 2B completion report — real-brand demo catalog ingestion

Collected **31 Aug 2026**. Local demonstration only. Images are **not** cleared for production publishing.

## Brands successfully collected (9)

| Brand | Products staged | Notes |
| --- | ---: | --- |
| Nature's Way | 7 | JSON-LD, Shopify public HTML |
| Twinlab | 7 | `/shop/{slug}/` product pages |
| Bluebonnet Nutrition | 7 | JSON-LD |
| MegaFood | 7 | JSON-LD |
| MaryRuth's | 7 | JSON-LD |
| NaturesPlus (Source of Life line) | 7 | Parent brand NaturesPlus |
| Woodstock Foods | 7 | Natural foods only |
| Gaia Herbs | 7 | JSON-LD |
| Vital Planet | 7 | JSON-LD |
| **Total** | **63** | Run `N3zCZtuXC-kLaKC9KH4Tmo` |

## Brands skipped or blocked (4)

| Brand | Reason |
| --- | --- |
| Solgar | robots.txt HTTP 403 (bot protection) |
| Garden of Life | robots.txt HTTP 403 (bot protection) |
| Life Extension | robots.txt HTTP 403 on later checks |
| NOW Foods | robots.txt Allow `/`, but catalog HTML returns HTTP 403 |

No products were fabricated for skipped sources.

## Category coverage (this run)

Multivitamins 13, Probiotics 9, Herbal supplements 8, Natural foods 7, Vitamin D 5, Magnesium 5, Zinc 5, Omega oils 3, Vitamin C 3, Digestive support 2, Minerals 1, Immune support 1, Brain wellness 1.

Forms present: gummy, capsule, tablet, chewable, softgel, liquid, powder, other (food).

## Images

- Downloaded and optimized (WebP, `demo_review_only` / `permission_pending`): **55**
- Missing or permission required (placeholder): **8**
- Rejected: **1**

## Validation, duplicates, pricing

- Validation failures: **0**
- Duplicate matches against the earlier dry-run: **15** (flagged, not extra live SKUs invented)
- Demo prices: deterministic `$x.99` in `$9.99–$79.99`; sale = `regular × (1 − percent/100)` with 10/20/30/40% buckets

## Database

- Models: `CatalogSource`, `CatalogImportRun`, `CatalogStagedProduct`, `CatalogStagedVariant`, `CatalogStagedImage`, `CatalogImportError`, `CatalogImportApproval`
- Product provenance columns added (source price, `price_is_demo`, hashes, parent brand, etc.)
- Migration: `backend/alembic/versions/b7c4e91a2d10_phase2b_catalog_staging.py`
- Runtime also applies `app/db/schema_patch.py` so existing SQLite files gain new columns without a manual migrate

## Admin routes

- `/admin/catalog-imports`
- `/admin/catalog-imports/new`
- `/admin/catalog-imports/[runId]`
- `/admin/catalog-imports/sources`

## Backend endpoints (development-only)

- `GET/PATCH /api/v1/admin/catalog-sources`
- `POST/GET /api/v1/admin/catalog-imports`
- `GET /api/v1/admin/catalog-imports/{run_id}`
- `POST .../collect`, `.../approve`, `.../reject`, `.../import`, `.../recalculate`, `.../retry-failed`
- `PATCH .../products/{id}`
- `GET .../export`, `.../errors`

## Commands

```text
python -m app.catalog.cli collect --brand now-foods --limit 6
python -m app.catalog.cli collect --brand solgar --limit 6 --dry-run
python -m app.catalog.cli collect-all --per-brand 6
python -m app.catalog.cli collect-all --per-brand 6 --skip-images
python -m app.catalog.cli validate --run-id RUN_ID
python -m app.catalog.cli export --run-id RUN_ID
npm run catalog:collect
npm run catalog:collect:dry
npm run catalog:validate
npm run catalog:test
```

Final collection used: `python -m app.catalog.cli collect-all --per-brand 7`

Approved and imported 63 products (active) for the local demo so they appear in the main admin table and storefront.

## Tests

- Pytest: **55 passed**, 13 skipped (opt-in live smoke tests)
- Frontend: lint + `tsc --noEmit` pass
- Playwright screenshot flow: pass
- Production `next build`: see verification below

## Screenshots (local, gitignored `.screenshots/`)

- `p2b-import-review-table.png` — import review table
- `p2b-admin-products-imported.png` — main admin product table with demo-price / demo-data / source link
- `p2b-storefront-real-brands.png` — Nature's Way products on the storefront
- `p2b-catalog-sources.png` — source policy page
- `p2b-import-runs.png` — run list

## Remaining permissions before production publishing

1. Written manufacturer (or authorized distributor) permission to use package images, or an official asset feed.
2. Do not mark `image_use_status` as production-approved until that permission exists.
3. Replace demo prices with owner-set store prices; keep `price_is_demo` until then.
4. Confirm each brand’s terms for any public-site reuse beyond this private local demo.
5. Supabase auth + server-verified admin RBAC (remove the role chooser).
6. Stripe is still out of scope.
7. Solgar, Garden of Life, Life Extension, and NOW Foods need a permitted channel (authorized feed or manual admin entry) — do not bypass their bot protection.
