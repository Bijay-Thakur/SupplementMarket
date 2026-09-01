# Catalog import (Phase 2 + 2B)

Phase 2 CSV import remains: admin editor, owner CSV, later authorized feeds.

## Phase 2B — official manufacturer pages

A robots-respecting collector stages a small set of real products from approved brand sites into `catalog_staged_*` tables. Admin review at `/admin/catalog-imports` is required before products enter the main catalog.

- CLI: `python -m app.catalog.cli collect --brand now-foods --limit 6`
- Dry-run: `python -m app.catalog.cli collect --brand solgar --limit 6 --dry-run`
- All brands: `python -m app.catalog.cli collect-all --per-brand 6`
- Skip images: add `--skip-images`
- Validate: `python -m app.catalog.cli validate --run-id RUN_ID`
- Export: `python -m app.catalog.cli export --run-id RUN_ID`

Images are stored as `permission_pending` / `demo_review_only`. They must not be marked production-approved without written permission or an authorized retailer asset feed.

Do not scrape Amazon, Walmart, competing retailers, or Google Shopping.

## Staging / review

CSV commit and manufacturer collection both create products that stay inactive until an admin activates them (unless “Activate after import” is selected).

## Staging / review

CSV commit creates or updates products with:

- `is_active=false`
- `approval_status=pending`
- `verification_status=pending_review`

They do not appear on the storefront until an admin activates them.

## Provenance fields (on `products`)

| Field | Purpose |
| --- | --- |
| `source_url` | Origin page or feed URL |
| `source_type` | e.g. `owner_spreadsheet`, `manufacturer_feed`, `synthetic_demo` |
| `source_access_date` | When the source was accessed |
| `upc` | Identifier for duplicate detection |
| `image_use_status` | Whether an original image URL may be used |
| `verification_status` | `unverified` / `pending_review` / `verified` |
| `approval_status` | `pending` / `approved` |

Do not download copyrighted product images without permission. Use the neutral placeholder until a licensed asset is uploaded.
