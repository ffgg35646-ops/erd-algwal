'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Product } from '@/lib/products';
import { formatPrice } from '@/lib/products';
import { useCart } from '@/components/CartProvider';

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart(product.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className="product-card">
      <Link href={'/products/' + product.id} className="product-image-link" aria-label={'تفاصيل ' + product.name}>
        <div className="product-image-wrap">
          {product.badge ? <span className="product-badge">{product.badge}</span> : null}
          <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
        </div>
      </Link>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <Link href={'/products/' + product.id} className="product-name">{product.name}</Link>
        <p className="product-description">{product.shortDescription}</p>
        <div className="product-price-row">
          <div className="price-group">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice ? <del>{formatPrice(product.oldPrice)}</del> : null}
          </div>
          <div className="product-card-actions">
            <button className={'add-cart-button' + (added ? ' is-added' : '')} type="button" onClick={handleAdd} aria-label={'إضافة ' + product.name + ' إلى السلة'}>
              {added ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg>
              )}
            </button>
            <Link href="/cart" className="product-card-cart-link" aria-label="الانتقال إلى سلة المشتريات" title="عرض السلة">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
