# Phase 2 — Local Catalog, Admin, Search, Cart (implementation plan)

**Status:** implementing on top of Phase 1. Do not replace the Next.js app.

## What already exists

- Next.js 16 storefront shell, brand system, routes, logo, a11y primitives.
- FastAPI backend under `backend/` with SQLite models, Alembic, product/order/CSV/image APIs, demo seed (~53 synthetic products).
- Supabase + Stripe adapters remain unused placeholders.

## What this phase adds

1. Backend polish: package inits, form values, search suggestions, related products, promotions CRUD, `public_token` on order confirmation, auto-create tables + seed on empty DB, pytest coverage.
2. Next.js API client + TanStack Query. Rewrites `/api/v1` and `/media` to FastAPI (`localhost:8000`).
3. Development-only role chooser (`NEXT_PUBLIC_DEMO_ROLE_SELECTOR_ENABLED`). Not authentication.
4. Live storefront: home merchandising, catalog filters (URL-synced), PDP, brands/categories, sales/new, search suggestions, cart, pickup/delivery demo order.
5. Admin portal: dashboard, products (inline edits), editor, brands/categories/tags, sales, orders, settings, CSV import, demo reset.
6. Root scripts `dev:web`, `dev:api`, `dev:all`, `seed:demo`, `test:all`.

## Reserved for later

- Supabase Auth + server-verified admin RBAC (role chooser must be removed).
- Stripe Checkout / webhooks.
- Production ~30-table Postgres schema / RLS.
