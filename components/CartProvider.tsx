'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type CartMap = Record<string, number>;

type CartContextValue = {
  cart: CartMap;
  itemCount: number;
  hydrated: boolean;
  addToCart: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
};

const STORAGE_KEY = 'erd-algwal-cart-v1';
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartMap>({});
  const [hydrated, setHydrated] = useState(false);

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
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // The shop remains usable if browser storage is disabled or full.
    }
  }, [cart, hydrated]);

  const addToCart = useCallback((productId: string, quantity = 1) => {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    setCart((current) => ({
      ...current,
      [productId]: (current[productId] || 0) + safeQuantity
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
    () => ({ cart, itemCount, hydrated, addToCart, setQuantity, removeFromCart }),
    [cart, itemCount, hydrated, addToCart, setQuantity, removeFromCart]
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
