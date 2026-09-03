"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { CartItem, CartState } from "@/lib/cart/storage";
import { cartCount, cartSubtotalCents, loadCart, saveCart } from "@/lib/cart/storage";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY_CART: CartState = { version: 1, items: [] };
let memory: CartState | null = null;

function getSnapshot(): CartState {
  if (memory == null) memory = loadCart();
  return memory;
}

function persist(next: CartState) {
  memory = next;
  saveCart(next);
  emit();
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CART);

  const add = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    const current = loadCart();
    const existing = current.items.find((i) => i.productId === item.productId);
    const items = existing
      ? current.items.map((i) =>
          i.productId === item.productId
            ? { ...i, ...item, quantity: Math.min(99, i.quantity + qty) }
            : i,
        )
      : [...current.items, { ...item, quantity: Math.min(99, qty) }];
    persist({ version: 1, items });
  }, []);

  const setQty = useCallback((productId: number, qty: number) => {
    const current = loadCart();
    const items =
      qty <= 0
        ? current.items.filter((i) => i.productId !== productId)
        : current.items.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.min(99, qty) } : i,
          );
    persist({ version: 1, items });
  }, []);

  const remove = useCallback((productId: number) => {
    const current = loadCart();
    persist({
      version: 1,
      items: current.items.filter((i) => i.productId !== productId),
    });
  }, []);

  const clear = useCallback(() => persist({ version: 1, items: [] }), []);

  const value = useMemo(
    () => ({
      items: state.items,
      count: cartCount(state.items),
      subtotalCents: cartSubtotalCents(state.items),
      add,
      setQty,
      remove,
      clear,
    }),
    [state.items, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
