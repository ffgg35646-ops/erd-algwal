'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '@/lib/products';

type CartMap = Record<string, number>;
export type StoreCategory = { id: string; name: string; description: string; icon?: string };

type CartContextValue = {
  cart: CartMap;
  itemCount: number;
  hydrated: boolean;
  catalogProducts: Product[];
  catalogCategories: StoreCategory[];
  catalogStatus: 'loading' | 'ready' | 'error';
  /** null means the red category bar currently shows all active categories. */
  redCategoryBarIds: string[] | null;
  addToCart: (productId: string, quantity?: number, color?: string, storage?: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  refreshCatalog: () => Promise<void>;
};

const STORAGE_KEY = 'erd-algwal-cart-v1';

function decodeCartVariant(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function makeCartItemKey(productId: string, color?: string, storage?: string) {
  if (storage) {
    return productId + '::' + encodeURIComponent(color || '') + '::' + encodeURIComponent(storage);
  }
  return color ? productId + '::' + encodeURIComponent(color) : productId;
}

export function parseCartItemKey(itemKey: string) {
  const parts = itemKey.split('::');
  if (parts.length >= 3) {
    return {
      productId: parts.slice(0, -2).join('::'),
      color: decodeCartVariant(parts[parts.length - 2]),
      storage: decodeCartVariant(parts[parts.length - 1])
    };
  }
  if (parts.length === 2) {
    return { productId: parts[0], color: decodeCartVariant(parts[1]), storage: '' };
  }
  return { productId: itemKey, color: '', storage: '' };
}
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [cartNotice, setCartNotice] = useState('');
  // Never render a bundled or browser-cached catalogue before MongoDB responds.
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<StoreCategory[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [redCategoryBarIds, setRedCategoryBarIds] = useState<string[] | null>(null);

  const refreshCatalog = useCallback(async () => {
    try {
      // The catalogue is authoritative database data: bypass browser and CDN caches.
      const response = await fetch('/api/catalog', { cache: 'no-store' });
      if (!response.ok) throw new Error('Catalogue request failed');

      const data = await response.json() as {
        products?: Product[];
        categories?: StoreCategory[];
        redCategoryBarIds?: string[] | null;
      };
      if (!Array.isArray(data.products) || !Array.isArray(data.categories)) {
        throw new Error('Catalogue response is incomplete');
      }

      setCatalogProducts(data.products);
      setCatalogCategories(data.categories);
      setRedCategoryBarIds(
        Array.isArray(data.redCategoryBarIds)
          ? data.redCategoryBarIds.filter((id): id is string => typeof id === 'string')
          : null
      );
      setCatalogStatus('ready');
    } catch {
      // A failed database read must never leave old or bundled products visible.
      setCatalogProducts([]);
      setCatalogCategories([]);
      setRedCategoryBarIds(null);
      setCatalogStatus('error');
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cleaned: CartMap = {};
          const productTotals: Record<string, number> = {};
          for (const [id, quantity] of Object.entries(parsed)) {
            if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) continue;
            const productId = parseCartItemKey(id).productId;
            const remaining = Math.max(0, 2 - (productTotals[productId] || 0));
            const accepted = Math.min(Math.floor(quantity), remaining);
            if (accepted > 0) {
              cleaned[id] = accepted;
              productTotals[productId] = (productTotals[productId] || 0) + accepted;
            }
          }
          setCart(cleaned);
        }
      }
    } catch {
      // Ignore malformed or unavailable browser storage and start with an empty cart.
    }

    setHydrated(true);

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

  const showCartLimitNotice = useCallback(() => {
    setCartNotice('الحد المسموح فقط منتجين من هذا المنتج');
  }, []);

  useEffect(() => {
    if (!cartNotice) return;
    const timer = window.setTimeout(() => setCartNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [cartNotice]);

  const addToCart = useCallback((productId: string, quantity = 1, color?: string, storage?: string) => {
    const requestedQuantity = Math.max(1, Math.floor(quantity));
    const itemKey = makeCartItemKey(productId, color, storage);
    const productQuantity = Object.entries(cart).reduce((total, [key, count]) =>
      total + (parseCartItemKey(key).productId === productId ? count : 0), 0);
    const remaining = Math.max(0, 2 - productQuantity);
    const acceptedQuantity = Math.min(requestedQuantity, remaining);
    if (acceptedQuantity < requestedQuantity) showCartLimitNotice();
    if (acceptedQuantity > 0) {
      setCart({ ...cart, [itemKey]: (cart[itemKey] || 0) + acceptedQuantity });
    }
  }, [cart, showCartLimitNotice]);

  const setQuantity = useCallback((cartItemKey: string, quantity: number) => {
    const next = { ...cart };
    if (quantity <= 0) {
      delete next[cartItemKey];
      setCart(next);
      return;
    }
    const productId = parseCartItemKey(cartItemKey).productId;
    const otherQuantity = Object.entries(cart).reduce((total, [key, count]) =>
      total + (key !== cartItemKey && parseCartItemKey(key).productId === productId ? count : 0), 0);
    const allowedQuantity = Math.min(Math.floor(quantity), Math.max(0, 2 - otherQuantity));
    if (allowedQuantity < quantity) showCartLimitNotice();
    if (allowedQuantity === 0) delete next[cartItemKey];
    else next[cartItemKey] = allowedQuantity;
    setCart(next);
  }, [cart, showCartLimitNotice]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({});
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The cart state is still cleared for the current session.
    }
  }, []);

  const itemCount = useMemo(
    () => Object.values(cart).reduce((total, quantity) => total + quantity, 0),
    [cart]
  );

  const value = useMemo(
    () => ({
      cart, itemCount, hydrated, catalogProducts, catalogCategories, catalogStatus, redCategoryBarIds,
      addToCart, setQuantity, removeFromCart, clearCart, refreshCatalog
    }),
    [cart, itemCount, hydrated, catalogProducts, catalogCategories, catalogStatus, redCategoryBarIds, addToCart, setQuantity, removeFromCart, clearCart, refreshCatalog]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {cartNotice ? (
        <div role="alert" aria-live="polite" style={{ position: 'fixed', zIndex: 10000, bottom: '24px', left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 32px)', padding: '12px 18px', borderRadius: '12px', background: '#252525', color: '#fff', fontSize: '14px', fontWeight: 600, textAlign: 'center', boxShadow: '0 8px 28px rgba(0,0,0,.2)' }}>
          {cartNotice}
        </div>
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return value;
}
