'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductDetails from '@/components/ProductDetails';
import { useCart } from '@/components/CartProvider';
import type { Product } from '@/lib/products';

export default function ProductDetailsLoader({
  id,
  initialProduct
}: {
  id: string;
  initialProduct: Product | null;
}) {
  const { catalogProducts } = useCart();
  const cachedProduct = catalogProducts.find((item) => item.id === id) || null;
  const [product, setProduct] = useState<Product | null>(initialProduct || cachedProduct);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (cachedProduct) {
      setProduct(cachedProduct);
      setNotFound(false);
    }

    let cancelled = false;
    const controller = new AbortController();

    // Refresh the product in the background. The cached or built-in product
    // remains visible while MongoDB responds.
    void fetch('/api/products/' + encodeURIComponent(id), {
      cache: 'no-store',
      signal: controller.signal
    }).then(async (response) => {
      if (response.status === 404) {
        if (!cancelled) {
          setProduct(null);
          setNotFound(true);
        }
        return;
      }
      if (!response.ok) return;

      const payload = await response.json() as { product?: Product };
      if (!cancelled && payload.product) {
        setProduct(payload.product);
        setNotFound(false);
      }
    }).catch(() => {
      // Keep the already visible product when background refresh is unavailable.
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, cachedProduct]);

  if (product) return <ProductDetails product={product} />;
  if (!notFound) return null;

  return (
    <main className="container product-detail-page">
      <section className="product-detail-card" style={{ padding: 32, textAlign: 'center' }}>
        <h1>المنتج غير متاح حاليًا</h1>
        <p>ربما تم حذف المنتج من المتجر.</p>
        <Link href="/#categories" className="primary-button">العودة إلى المنتجات</Link>
      </section>
    </main>
  );
}
