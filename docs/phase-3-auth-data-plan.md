# Gate 1 — Persistence, auth, search, and payments plan

This document is the migration plan for replacing the in-memory Vercel demo store with a dual-mode architecture. The storefront look, catalog photos, and current checkout UX stay in place.

## Problem

`src/lib/demo-store/engine.ts` clones `catalog.json` into `globalThis`. Admin edits and orders are lost on cold start and are not shared across serverless instances. That is acceptable only while `DATA_PROVIDER=snapshot`.

## Modes (fail closed)

| Profile | AUTH_PROVIDER | DATA_PROVIDER | PAYMENT_PROVIDER |
| --- | --- | --- | --- |
| Hosted demo (default) | mock | snapshot | disabled |
| Persistent client demo | mock | supabase | disabled |
| Stripe test | supabase | supabase | stripe_test |
| Production | supabase | supabase | stripe_live |

Invalid combinations throw a server-side configuration error at startup. Browser flags never authorize admin or payment.

## Data access

Both snapshot and Supabase implement the same catalog/order/profile contracts. Search ranking, cents pricing, and order snapshots are shared modules. FastAPI remains an optional collector; it must not invent a third pricing or search policy.

Snapshot mode:

- Reads bundled catalog
- Mutations are session-only and labeled as such
- Refuses real customer PII persistence and Stripe

Supabase mode:

- PostgreSQL + RLS is the source of truth
- Service role is server-only
- Catalog import from `catalog.json` is idempotent

## Auth

- **mock:** signed HttpOnly cookie, no Google network call, no password storage
- **supabase:** `@supabase/ssr` cookie sessions, email + Google, server-verified roles

Admin status never comes from localStorage, query params, or email domain. Request-level `proxy.ts` can redirect; Route Handlers and data functions still call `requireUser` / `requireAdmin`.

## Payments

Stripe Checkout + signed webhooks, fully implemented, **off** until `PAYMENT_PROVIDER` is `stripe_test` or `stripe_live`. Success URL never marks an order paid.

## Search

Shared concept-group matcher (AND across groups, OR within synonyms), weighted ranking, limited typo tolerance, golden-query tests. Postgres FTS + trigram indexes when Supabase is the data provider.

## Brand logos

Schema and UI support official `logo_url` with `object-contain` cards. Missing logos keep the current text treatment. No Google Images scraping.
