import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BrandCard } from "@/components/catalog/brand-card";
import { renderToStaticMarkup } from "react-dom/server";

const sql = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260902120000_init_commerce.sql"),
  "utf8",
);

describe("committed supabase migration", () => {
  it("enables RLS and admin checks", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/is_admin/);
    expect(sql).toMatch(/user_roles/);
    expect(sql).toMatch(/create table if not exists public.profiles/);
    expect(sql).toMatch(/create table if not exists public.payments/);
    expect(sql).toMatch(/revoke all on public.payments from anon, authenticated/i);
    expect(sql).not.toMatch(/grant all on public.profiles to anon/i);
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
