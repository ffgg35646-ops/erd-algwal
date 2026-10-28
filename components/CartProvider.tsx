'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { categories as seedCategories, products as seedProducts, type Product } from '@/lib/products';

type CartMap = Record<string, number>;
export type StoreCategory = { id: string; name: string; description: string; icon?: string };

type CartContextValue = {
  cart: CartMap;
  itemCount: number;
  hydrated: boolean;
  catalogProducts: Product[];
  catalogCategories: StoreCategory[];
  addToCart: (productId: string, quantity?: number, color?: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  refreshCatalog: () => Promise<void>;
};

const STORAGE_KEY = 'erd-algwal-cart-v1';

export function makeCartItemKey(productId: string, color?: string) {
  return color ? productId + '::' + encodeURIComponent(color) : productId;
}

export function parseCartItemKey(itemKey: string) {
  const divider = itemKey.lastIndexOf('::');
  if (divider < 0) return { productId: itemKey, color: '' };
  try {
    return { productId: itemKey.slice(0, divider), color: decodeURIComponent(itemKey.slice(divider + 2)) };
  } catch {
    return { productId: itemKey.slice(0, divider), color: itemKey.slice(divider + 2) };
  }
}
const CartContext = createContext<CartContextValue | null>(null);

const FALLBACK_CATEGORIES: StoreCategory[] = seedCategories.map((category) => ({
  id: category.name,
  name: category.name,
  description: category.description,
  icon: category.icon
}));

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(seedProducts);
  const [catalogCategories, setCatalogCategories] = useState<StoreCategory[]>(FALLBACK_CATEGORIES);

  const refreshCatalog = useCallback(async () => {
    try {
      const response = await fetch('/api/catalog', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { products?: Product[]; categories?: StoreCategory[] };
      if (Array.isArray(data.products)) setCatalogProducts(data.products);
      if (Array.isArray(data.categories)) setCatalogCategories(data.categories);
    } catch {
      // Keep the built-in catalog available if MongoDB is not configured yet.
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cleaned: CartMap = {};
          for (const [id, quantity] of Object.entries(parsed)) {
            if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0) {
              cleaned[id] = Math.floor(quantity);
            }
          }
          setCart(cleaned);
        }
      }
    } catch {
      // Ignore malformed or unavailable browser storage and start with an empty cart.
    } finally {
      setHydrated(true);
    }

    void refreshCatalog();
    const refreshTimer = window.setInterval(() => { void refreshCatalog(); }, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [refreshCatalog]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // The shop remains usable if browser storage is disabled or full.
    }
  }, [cart, hydrated]);

  const addToCart = useCallback((productId: string, quantity = 1, color?: string) => {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const itemKey = makeCartItemKey(productId, color);
    setCart((current) => ({
      ...current,
      [itemKey]: (current[itemKey] || 0) + safeQuantity
    }));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = Math.floor(quantity);
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }, []);

  const itemCount = useMemo(
    () => Object.values(cart).reduce((total, quantity) => total + quantity, 0),
    [cart]
  );

  const value = useMemo(
    () => ({
      cart, itemCount, hydrated, catalogProducts, catalogCategories,
      addToCart, setQuantity, removeFromCart, refreshCatalog
    }),
    [cart, itemCount, hydrated, catalogProducts, catalogCategories, addToCart, setQuantity, removeFromCart, refreshCatalog]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return value;
}
