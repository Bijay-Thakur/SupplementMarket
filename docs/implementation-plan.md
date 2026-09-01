# Bronxville Natural Market — Implementation Plan

> **Status:** Phase 0–2 complete. Phase 2 is a **local FastAPI + SQLite demo** (catalog, admin, search, cart, demo orders) with the development-only role chooser. Supabase Auth and Stripe remain deferred.
> **Owner-provided data still required** is tracked in [§7](#7-assumptions--unresolved-owner-data).

---

## 1. Repository audit (findings)

| Item | Finding |
| --- | --- |
| Working directory | `D:\Projects\Bronxville natural` |
| Git repository | **None** — no `.git` present. Will `git init` in Phase 1. |
| Existing code | **None** — greenfield. |
| Existing asset | One file `logo` (PNG, 751×751, 187 KB) = the official Bronxville Natural Market logo. |
| Package manager | None present. Node **v24.19.0**, npm **11.17.0** available → **npm** (with committed `package-lock.json`). |
| OS / shell | Windows (`win32 10.0.26200`), PowerShell. |

**Logo verification:** confirmed visually against the spec — deep-magenta stylized lotus, green leaves + green uppercase wordmark "BRONXVILLE NATURAL MARKET", saffron/gold circular arc, white background, square canvas with generous negative space. The untouched source has been preserved at `public/brand/bronxville-natural-market-logo-source.png`. Web derivatives will be created in Phase 1 and diffed against this source. The lotus geometry and wordmark will not be redrawn.

**Decision: scaffolding, not extending.** The repo is empty, so we scaffold a fresh Next.js App Router project. No existing user code to preserve.

---

## 2. Architecture

### 2.1 Stack
- **Next.js (latest stable) App Router + TypeScript (strict)** — server components for read-heavy public pages; minimal client components.
- **Tailwind CSS** + design tokens driven by the sampled brand palette; `next/font` for a display + sans body pairing.
- **Supabase**: Postgres (migrations in-repo), Auth (Google OAuth for customers, email/role for admin), Storage (product images), RLS everywhere.
- **Stripe**: Stripe-hosted Checkout for card payments; webhooks are the source of truth for payment status.
- **Zod** for all input/env validation. **Vitest** (unit/integration) + **Playwright** (E2E). **axe** for a11y automation.

### 2.2 Module boundaries (`src/`)
```
app/                      # routes (public + (admin) route group)
  (public)/               # storefront layout
  (admin)/admin/          # admin layout, noindex
  api/                    # webhooks, checkout, search, phone-order, uploads
components/                # ui primitives + storefront/admin components
lib/
  env.ts                  # server/public env validation (separated)
  supabase/               # browser, server (SSR cookies), service-role (server-only)
  money/                  # integer-cents math, no floats
  pricing/                # list/base/effective price + promotion evaluation
  search/                 # SearchService interface + Postgres FTS impl
  orders/                 # state machine, idempotency, authoritative totals
  delivery/               # zone/fee resolution
  auth/                   # role checks, guards (server boundary)
  audit/                  # audit-log writer
  rate-limit/             # limiter adapter
db/
  migrations/             # SQL migrations (apply from zero)
  seed/                   # deterministic demo seed + safe reset
  types.ts                # generated Supabase types
docs/                     # plan, architecture, security, guides, checklists
tests/                    # unit, integration, rls, e2e
```

### 2.3 Key architectural decisions
- **Pricing model (canonical):** persist `list_price_cents` and `base_selling_price_cents` on variants; effective price derived by applying the highest-priority valid promotion server-side. Invariant `effective_price ≤ list_price`. Admin may enter percent or sale price; the other is computed and validated.
- **Money:** nonnegative integer cents + explicit `currency`; never JS floats for final currency.
- **Availability:** enum `in_stock | low_stock | out_of_stock | special_order | discontinued`; display labels app-controlled; **no quantities exposed**. Server rejects checkout of out_of_stock/discontinued/archived/unpublished.
- **Order totals:** always recomputed server-side at checkout from authoritative catalog/promo/delivery/tax; client totals never trusted.
- **Order item snapshots:** immutable purchase-time copies (name, variant, SKU, unit price, discount, tax, qty).
- **Cart:** guest cart persisted client-side with schema `version` + corruption recovery; server revalidates on load/checkout. Documented merge path for when customer auth is enabled.
- **Search:** deterministic PostgreSQL FTS (weighted tsvector) + `pg_trgm` for typos, behind a `SearchService` interface. No external LLM in the core path. Admin-editable synonyms/aliases. Ranking = documented weighted formula (exact > availability > merchandising boost > text relevance > trigram); sales status must not overwhelm relevance.
- **Idempotency:** client idempotency key → server validates schema/rate-limit → re-fetch authoritative data → single pending order + Stripe idempotency key in one transaction. Same key+different body ⇒ conflict. Stripe events deduped via `stripe_events` unique constraint; processed exactly once.
- **Auth boundaries:** customer auth fully built but gated by `NEXT_PUBLIC_CUSTOMER_AUTH_ENABLED=false`; guest checkout always works. Admin auth always enforced at the server boundary **and** per-mutation (middleware alone insufficient). Roles: `owner`, `manager`, `staff`; deny-by-default RLS. Service-role key server-only.
- **Tax:** behind a `TaxService` interface; dev uses an explicitly labeled manual rule only if owner-supplied; production blocked until Stripe Tax or owner-approved NY rules configured.

### 2.4 Order/payment state machines
- **Order:** `pending_payment → placed → confirmed → preparing → {ready_for_pickup | out_for_delivery} → completed`; `cancelled` reachable from pre-terminal states. Valid transitions depend on fulfillment/payment method; centralized + tested.
- **Payment:** `unpaid → pending → paid`; `failed`, `partially_refunded`, `refunded`. Card orders never marked paid from the redirect — webhook authoritative. Pay-at-pickup starts `unpaid`.

---

## 3. Component map (high level)

- **Global:** `SiteHeader` (logo, nav, mega-menu, search, cart count, phone CTA), `AnnouncementBar`, `SiteFooter`, `MobileNav`.
- **Storefront:** `ProductCard`, `ProductGrid`, `FilterSidebar`/`FilterChips`, `Pagination`, `ProductGallery`, `VariantSelector`, `PriceDisplay`, `AvailabilityBadge`, `AddToCart`, `RelatedProducts`, `MedicalDisclaimer`, home merchandising sections.
- **Cart/checkout:** `CartView`, `CartChangedNotice`, `FulfillmentSelector`, `DeliveryAddressForm`, `PaymentMethodSelector`, `OrderSummary`, `ConfirmationStatus`.
- **Admin:** `AdminShell`, `ProductEditor`, `VariantEditor`, `ImageManager`, `TaxonomyManager`, `PromotionEditor`, `MerchandisingEditor`, `OrdersTable`, `OrderDetail`, `PhoneOrderForm`, `SettingsForm`, `AuditLogViewer`, `UserRolesManager`.
- **UI primitives:** Button, Input, Select, Combobox, Dialog, Badge, Skeleton, Toast, Table, Tabs, FormField — all keyboard/focus/reduced-motion friendly.

---

## 4. Data model draft

Normalized relations (UUID PKs, unique slugs for URLs, integer cents, UTC timestamps, `numeric` only for strength/measurement):

`profiles`, `user_roles`, `admin_invitations`, `brands`, `products`, `product_variants`, `product_images`, `categories`, `product_categories`, `wellness_goals`, `product_wellness_goals`, `ingredients`, `product_ingredients`, `attributes`, `product_attributes`, `search_aliases`, `search_synonyms`, `promotions`, `promotion_products`(+/`promotion_rules`), `merchandising_sections`, `merchandising_items`, `carts`, `cart_items` (or documented anonymous-cart strategy), `orders`, `order_items`, `order_addresses`, `payments`, `stripe_events`, `order_idempotency_keys`, `delivery_zones`, `store_settings`, `admin_audit_logs`, `search_query_logs`.

Invariants (FKs, check + uniqueness constraints, indexes, transactions) enforce: variant-level purchasable fields; unique slugs/SKUs; `archived_at` soft-delete when order-referenced; immutable `order_items`; app-controlled availability enum; server-rejected checkout of unavailable variants; `effective_price ≤ list_price`; timezone-aware promotion scheduling with deterministic conflict priority; private addresses/contact never in public queries/logs/Stripe metadata/confirmation URLs. Full ER model + pricing precedence documented in `docs/architecture.md` (Phase 2).

---

## 5. Threat model draft (elaborated in `docs/security.md`, Phase 7)

- **Trust boundaries:** browser (untrusted) → Next server (trusted) → Supabase (RLS) / Stripe. Service-role and Stripe secret only in server code.
- **Primary abuse cases & controls:** price tampering (server recompute), IDOR on orders (high-entropy public token + RLS, no sequential IDs in URLs), webhook replay (signature verify on raw body + event dedupe), privilege escalation (server-side role check, no client-trusted role, deny-by-default RLS), malicious uploads (MIME/signature/dimension/size validation, safe paths, no unsanitized SVG), mass assignment (Zod allow-lists), SQLi (parameterized/RLS), open redirects/path traversal, stored XSS in admin content (structured content over arbitrary HTML), enumeration (random cart/order tokens), spam (rate limits + bot mitigation on forms).
- **Privacy:** order contents treated as sensitive; excluded from general analytics; retention rules for carts/search logs/addresses/orders.

---

## 6. Acceptance-test map (spec → tests)

| Requirement | Test type | Location (planned) |
| --- | --- | --- |
| Money math / rounding | unit | `tests/unit/money.test.ts` |
| Promotion precedence & scheduling | unit | `tests/unit/pricing.test.ts` |
| Delivery fee/min/free-threshold | unit | `tests/unit/delivery.test.ts` |
| Cart validation / changed price | unit | `tests/unit/cart.test.ts` |
| Order/payment transitions | unit | `tests/unit/state-machine.test.ts` |
| Idempotency / request hash | unit + integration | `tests/unit/idempotency.test.ts`, `tests/integration/checkout.test.ts` |
| Search normalize/synonym/rank/typo/unsafe/empty | unit | `tests/unit/search.test.ts` |
| Authorization/role helpers | unit | `tests/unit/auth.test.ts` |
| RLS: public-read only, cross-user denial, order enumeration, role matrix, archived-not-checkout-able, constraint rejections | db/rls | `tests/rls/*.test.ts` |
| Tampered totals ignored; duplicate request→one order; key+changed body conflict; duplicate/out-of-order Stripe events; invalid signature; pay-at-pickup unpaid; upload rejects bad files; admin mutation→audit | integration | `tests/integration/*.test.ts` |
| Browse/filter/search/product; cart; pickup+pay-at-pickup; delivery validation; Stripe test checkout; auth flag on/off; admin unauthorized denial; admin CRUD→publish→price→sale→storefront; admin processes pickup order | e2e | `tests/e2e/*.spec.ts` |
| a11y (axe) on core routes; responsive; Lighthouse budgets | tooling | CI + `tests/a11y` |

---

## 7. Assumptions & unresolved owner data

**Safe assumptions made (will revisit if wrong):**
- Package manager = **npm**; single Next.js app at repo root; `src/` directory; Stripe-hosted Checkout (not Payment Element); `America/New_York` store timezone; USD currency.

**Unresolved — modeled as owner-editable settings or explicitly-labeled placeholder seed (not fabricated):**
- Verified business phone number (dev placeholder, admin-configurable).
- Store hours, announcement content, pickup readiness time, address display specifics.
- Delivery zones, fees, minimums, free-delivery thresholds.
- Tax handling (NY) — production-blocked until Stripe Tax or owner-approved rules.
- Privacy/terms/returns/shipping-pickup/accessibility policy copy (placeholder shells, marked unpublished in non-prod).
- Real product catalog, images, supplement facts, certifications, health-claim/disclaimer wording (owner/legal approval before launch).
- Whether a Supabase project + Stripe account already exist (setup docs will cover both from scratch).

**No blocking product decision** requires an answer to begin Phase 1. One process question is posed in the report for how autonomously to proceed through the gated phases.

---

## 8. Phases & verification gates

| Phase | Scope | Gate |
| --- | --- | --- |
| 0 Audit & plan | this document | user can review; repo buildable ✅ |
| 1 Foundation & brand | scaffold Next.js, env validation, Supabase clients, tokens, optimized logo, layout, error boundaries, UI primitives | lint, typecheck, build, responsive shell, a11y smoke |
| 2 DB/RLS/storage/seed | migrations, functions/views/RPCs, policies, generated types, role bootstrap, image policies, demo seed + safe reset | migrations apply from zero; RLS/constraint tests; seed/reset safeguards |
| 3 Public catalog & search | home, catalog, filters, brands/categories, product detail, sales/new, search, SEO | search fixtures, catalog integration, a11y, query plans |
| 4 Cart/checkout/payment | guest cart, pickup/delivery, zones/fees, pay-at-pickup, Stripe Checkout, webhooks, idempotency, status page | tampering/dup-request/dup-event/bad-signature/state-machine/Stripe-test/E2E |
| 5 Admin portal | auth/RBAC, dashboard, catalog editor, images, taxonomy, promotions, merchandising, orders/phone orders, settings, audit log | role/audit tests, CRUD/publish/sale/order E2E, upload security, conflict handling |
| 6 Dormant customer auth | Google OAuth, profile, account orders, safe merge/association; flag stays false | auth on/off matrix; no broken links/forced login when disabled |
| 7 Hardening & handoff | perf, security headers, rate limits, logging/redaction, policy pages, docs, production checklist | production build, full suite, Lighthouse, axe, dep audit, manual checklist |

---

## 9. Environment variables (names only — see `.env.example` in Phase 1)
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CUSTOMER_AUTH_ENABLED`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STORE_TIMEZONE`. Server vs public validated separately so secrets can never be bundled.
