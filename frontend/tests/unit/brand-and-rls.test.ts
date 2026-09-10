import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BrandCard } from "@/components/catalog/brand-card";
import { renderToStaticMarkup } from "react-dom/server";

const catalogSql = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260903030807_product_catalog.sql"),
  "utf8",
);
const importSql = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260903040000_catalog_import_fields.sql"),
  "utf8",
);
const adminAuthSql = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260903050000_admin_catalog_authorization.sql"),
  "utf8",
);
const brandDiscountSql = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260909010000_brand_discounts.sql"),
  "utf8",
);

describe("committed supabase catalog migrations", () => {
  it("enables RLS and keeps catalog writes off public roles", () => {
    expect(catalogSql).toMatch(/enable row level security/i);
    expect(catalogSql).toMatch(/revoke all on public.products from anon, authenticated/i);
    expect(catalogSql).toMatch(/grant select on public.products to anon, authenticated/i);
    expect(catalogSql).not.toMatch(/grant insert on public.products to anon/i);
    expect(importSql).toMatch(/cost_price_cents/);
    expect(importSql).toMatch(/revoke all on public.catalog_import_batches from anon, authenticated/i);
    expect(importSql).not.toMatch(/grant insert on storage.objects to anon/i);
    expect(adminAuthSql).toMatch(/Admins write products/);
    expect(adminAuthSql).toMatch(/grant insert, update, delete on public.products to authenticated/);
    expect(adminAuthSql).toMatch(/Admins insert product images/);
  });

  it("keeps Store SRP synchronized with each brand discount", () => {
    expect(brandDiscountSql).toMatch(/add column discount_percent integer/i);
    expect(brandDiscountSql).toMatch(/brands_sync_discount_prices/i);
    expect(brandDiscountSql).toMatch(/product_variants_apply_brand_discount/i);
    expect(brandDiscountSql).toMatch(/products_sync_brand_discount_prices/i);
    expect(brandDiscountSql).toMatch(/round\([\s\S]*regular_price_cents[\s\S]*100 - [\s\S]*discount_percent/i);
  });
});

describe("brand card", () => {
  it("falls back to the brand name when no logo exists", () => {
    const html = renderToStaticMarkup(
      BrandCard({
        brand: {
          id: 1,
          name: "MaryRuth's",
          slug: "maryruth-s",
          description: null,
          is_featured: false,
          logo_url: null,
          logo_use_status: "permission_pending",
        },
      }),
    );
    expect(html).toContain("MaryRuth&#x27;s");
    expect(html).not.toContain("<img");
  });

  it("renders object-contain logo with accessible alt", () => {
    const html = renderToStaticMarkup(
      BrandCard({
        brand: {
          id: 1,
          name: "Twinlab",
          slug: "twinlab",
          description: null,
          is_featured: true,
          logo_url: "/brand/twinlab.svg",
          logo_alt: "Twinlab",
          logo_use_status: "permission_pending",
        },
      }),
    );
    expect(html).toContain("object-contain");
    expect(html).toContain('alt="Twinlab"');
    expect(html).toContain("permission pending");
  });
});
