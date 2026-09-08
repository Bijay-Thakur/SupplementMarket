/**
 * Guest cart persisted in localStorage with schema versioning.
 * Display snapshots are advisory; checkout always revalidates server prices.
 */

// Version 2 starts every browser with a clean cart. The previous key may
// contain legacy demo items from early builds of the storefront.
export const CART_STORAGE_KEY = "bnm-cart-v2";
export const CART_VERSION = 2;

export type CartItem = {
  productId: number | string;
  slug: string;
  name: string;
  brandName: string;
  quantity: number;
  unitPriceCents: number;
  availability: string;
  imageUrl: string | null;
};

export type CartState = {
  version: number;
  items: CartItem[];
};

const empty: CartState = { version: CART_VERSION, items: [] };

export function loadCart(): CartState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as CartState;
    if (parsed.version !== CART_VERSION || !Array.isArray(parsed.items)) return empty;
    return {
      version: CART_VERSION,
      items: parsed.items.filter(
        (i) =>
          (typeof i.productId === "number" || typeof i.productId === "string") &&
          typeof i.quantity === "number" &&
          i.quantity > 0 &&
          i.quantity <= 99,
      ),
    };
  } catch {
    return empty;
  }
}

export function saveCart(state: CartState): void {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
}

export function cartSubtotalCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
