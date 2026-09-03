# Bronxville Natural Market

Demonstration ecommerce site for **Bronxville Natural Market**  
86 Pondfield Rd, Bronxville, NY 10708

Customer storefront for vitamins and supplements, plus a demo admin portal. Shoppers can browse the catalog, search, filter, add to cart, and submit a **pickup or local-delivery order request**. Card payment is not enabled yet.

This is a **client demo**, not live inventory. Product photos come from official manufacturer pages and are labeled for demo review. Prices are demonstration pricing, not shelf prices.

**Store:** 86 Pondfield Rd, Bronxville, NY 10708 · +1 (914) 779-3552 · bronxvillenatural@gmail.com  
**Hours:** Monday–Saturday 9 AM–7 PM · Sunday 10 AM–6 PM

## Live demo (Vercel)

The storefront is a self-contained [Next.js](https://nextjs.org/) app in `frontend/`. No Python, Stripe, or Supabase keys are required.

1. Open [vercel.com/new](https://vercel.com/new)
2. Import this GitHub repository: [Bijay-Thakur/SupplementMarket](https://github.com/Bijay-Thakur/SupplementMarket)
3. Set **Root Directory** to `frontend`
4. Leave environment variables empty
5. Click **Deploy**

After the first deploy, optionally set `NEXT_PUBLIC_SITE_URL` to the Vercel domain (for example `https://your-app.vercel.app`).

| Surface | Path |
| --- | --- |
| Storefront | `/` |
| Catalog | `/products` |
| Admin | `/admin` |

The first visit shows a Customer / Admin role chooser. That starts a **demo authentication session** (signed HttpOnly cookie). It is not a real account. Admin APIs reject requests without that cookie.

Card payment is implemented behind `PAYMENT_PROVIDER=disabled`. Do not enter card numbers.

## What’s in the catalog

- **56 products** from official manufacturer sites (Nature’s Way, MegaFood, MaryRuth’s, Twinlab, Gaia Herbs, NaturesPlus, Bluebonnet, Vital Planet)
- Every storefront product has a manufacturer package photo
- Search understands common vitamin names and wellness-support phrases (for example `d3`, `omega 3`, `sleep`, `turmeric`)
- Brands that block crawlers (Solgar, NOW Foods, Garden of Life, Life Extension) were skipped — products were never invented

Images remain **permission-pending**. They are for local/demo review until the store has written manufacturer permission or an authorized asset feed.

## Local development

Copy `.env.example` to `.env` if you want to override defaults. One file at the repo root is used by both apps.

```powershell
npm install
npm run dev
```

Then open:

- Storefront: http://localhost:3000
- Admin: http://localhost:3000/admin

`npm run dev` is enough for the walkthrough. Python is only needed if you collect more manufacturer products later.

### Walkthrough for the store owner

1. Choose **Customer**
2. Search (try `turmeric`, `zinc`, or `probiotic`)
3. Open a product, add to cart, checkout as **store pickup**
4. Switch to **Admin** and open Products, Orders, and Store settings

## Admin

From `/admin` you can:

- View dashboard stats
- Edit products, prices, and availability
- Add brands, categories, and tags
- Review demo orders and update status
- Edit announcement, hours note, pickup, and delivery copy
- Preview a CSV import

Store settings include the owner-verified phone, email, address, and hours. Catalog prices remain demonstration pricing.

Live manufacturer re-collection (`npm run catalog:collect`) needs the optional Python backend. The hosted demo already includes the imported official catalog.

## Stack

- **App:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 in `frontend/`
- **Hosted demo API:** Next.js Route Handlers + bundled `frontend/src/data/catalog.json` (works on Vercel)
- **Optional collector:** FastAPI + SQLite in `backend/`, for robots-respecting manufacturer catalog imports
- **Later launch:** set `AUTH_PROVIDER=supabase`, `DATA_PROVIDER=supabase`, and `PAYMENT_PROVIDER=stripe_test` or `stripe_live` after applying `supabase/migrations` and filling credentials. See `.env.example` and `docs/phase-3-auth-data-plan.md`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js on port 3000 (demo API included) |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `typecheck` | Frontend quality checks |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright |
| `npm run dev:all` | Next.js + FastAPI collector on :8000 |
| `npm run catalog:collect` | Collect official products into staging (Python) |
| `npm run catalog:export` | Export the demo snapshot used on Vercel |

## Project layout

```
frontend/                  Next.js storefront + demo API
  src/app/(public)/        Storefront routes
  src/app/(admin)/         Admin routes (no-index)
  src/app/api/v1/          Bundled demo API for Vercel
  src/components/          UI, catalog, cart, admin
  src/data/catalog.json    Bundled official catalog
  public/brand/            Store logo (source of truth)
  public/media/            Optimized product photos
backend/                   Optional FastAPI collector
.env.example               Single env template for both apps
docs/                      Implementation notes
supabase/                  Schema for a later persistent launch
```

## Brand

The official logo is never redrawn. Source file:

`frontend/public/brand/bronxville-natural-market-logo-source.png`

Web derivatives are generated with `npm run logo:optimize`.

## Health disclaimer

These statements have not been evaluated by the Food and Drug Administration. Products are not intended to diagnose, treat, cure, or prevent any disease.

## License

Private demonstration for Bronxville Natural Market. Product names, packaging, and photos remain the property of their respective manufacturers.
