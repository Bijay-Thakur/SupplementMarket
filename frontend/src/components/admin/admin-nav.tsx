"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/new", label: "Add Product" },
  { href: "/admin/products/import", label: "CSV Import" },
  { href: "/admin/taxonomy", label: "Brands" },
  { href: "/admin/taxonomy", label: "Categories" },
  { href: "/admin/promotions", label: "Sales and Pricing" },
  { href: "/admin/products", label: "Product Images" },
  { href: "/admin/products/imports", label: "Import History" },
  { href: "/admin/settings", label: "Store Settings" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/catalog-imports", label: "Brand catalog import" },
  { href: "/admin/demo-data", label: "Sample catalog" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
    >
      {LINKS.map((l) => {
        const active = path === l.href;
        return (
          <Link
            key={`${l.href}:${l.label}`}
            href={l.href}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-[--radius] px-3 py-2 text-sm font-medium",
              active
                ? "bg-[color:var(--brand-green)] text-white"
                : "hover:bg-[color:var(--brand-cream)]",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
