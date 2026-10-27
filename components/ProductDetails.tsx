'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Product } from '@/lib/products';
import { formatPrice } from '@/lib/products';
import { useCart } from '@/components/CartProvider';

export default function ProductDetails({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const gallery = product.images?.length ? product.images : [product.image];
  const activeImage = gallery[Math.min(activeImageIndex, gallery.length - 1)] || product.image;

  function handleAdd() {
    addToCart(product.id, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <main className="container detail-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><Link href="/#products">المنتجات</Link><span>/</span><span>{product.name}</span></div>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-image-panel">
            {product.badge ? <span className="product-badge detail-badge">{product.badge}</span> : null}
            {activeImage ? <img src={activeImage} alt={product.name} className="detail-image" /> : <div className="detail-no-image">صورة المنتج غير متاحة</div>}
          </div>
          {gallery.length > 1 ? <div className="detail-thumbnails" aria-label="صور المنتج">
            {gallery.map((image, index) => <button type="button" className={index === activeImageIndex ? 'detail-thumbnail active' : 'detail-thumbnail'} key={image + index} onClick={() => setActiveImageIndex(index)} aria-label={'عرض الصورة ' + (index + 1)}><img src={image} alt="" /></button>)}
          </div> : null}
        </div>
        <div className="detail-information">
          <span className="product-category">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="detail-lead">{product.shortDescription}</p>
          <div className="detail-price-line"><strong>{formatPrice(product.price)}</strong>{product.oldPrice ? <del>{formatPrice(product.oldPrice)}</del> : null}</div>
          <div className="detail-rule" />
          <h2>عن المنتج</h2>
          <p className="detail-description">{product.description}</p>
          {product.colors?.length ? (
            <section className="detail-options"><h2>الألوان المتاحة</h2><div className="detail-option-chips">{product.colors.map((color) => <span key={color}>{color}</span>)}</div></section>
          ) : null}
          {product.storageOptions?.length ? (
            <section className="detail-options"><h2>مساحات التخزين</h2><div className="detail-option-chips">{product.storageOptions.map((storage) => <span key={storage}>{storage}</span>)}</div></section>
          ) : null}
          <h2>مميزات المنتج</h2>
          <ul className="spec-list">{product.specifications.map((specification) => <li key={specification}><span>✓</span>{specification}</li>)}</ul>
          <div className="detail-actions">
            <div className="quantity-control" aria-label="الكمية">
              <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="تقليل الكمية">−</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="زيادة الكمية">+</button>
            </div>
            <button type="button" className="primary-button detail-add-button" onClick={handleAdd}>{added ? 'تمت الإضافة ✓' : 'أضف إلى السلة'}</button>
          </div>
          <p className="detail-storage-note"><span>♧</span> إضافتك للسلة تُحفظ في هذا المتصفح حتى عند إغلاقه.</p>
          <Link href="/cart" className="text-link">عرض سلة المشتريات ←</Link>
        </div>
      </div>
    </main>
  );
}
