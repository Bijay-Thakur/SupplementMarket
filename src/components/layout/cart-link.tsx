"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-[--radius] text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]"
      aria-label={count ? `View cart, ${count} items` : "View cart"}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {count > 0 && (
        <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[color:var(--brand-magenta)] px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
