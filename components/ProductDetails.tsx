'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Product } from '@/lib/products';
import { formatPrice } from '@/lib/products';
import { useCart } from '@/components/CartProvider';

const COLOR_HEX: Record<string, string> = {
  'أسود': '#171717', 'اسود': '#171717', black: '#171717',
  'أبيض': '#fafafa', 'ابيض': '#fafafa', white: '#fafafa',
  'أحمر': '#d93642', 'احمر': '#d93642', red: '#d93642',
  'أصفر': '#f3cb3d', 'اصفر': '#f3cb3d', yellow: '#f3cb3d',
  'أزرق': '#2874d9', 'ازرق': '#2874d9', blue: '#2874d9',
  'أخضر': '#299660', 'اخضر': '#299660', green: '#299660',
  'بنفسجي': '#8255c5', purple: '#8255c5',
  'وردي': '#f09ab9', pink: '#f09ab9',
  'بني': '#805438', brown: '#805438',
  'برتقالي': '#ee851d', orange: '#ee851d',
  'رمادي': '#92969c', gray: '#92969c', grey: '#92969c',
  'ذهبي': '#c8a04c', gold: '#c8a04c',
  'فضي': '#c6cbd1', silver: '#c6cbd1',
  'تيتانيوم طبيعي': '#aaa69d', 'تيتانيوم': '#aaa69d',
  'أزرق داكن': '#1d355c', 'ازرق داكن': '#1d355c'
};

function getColorHex(color: string) {
  const key = color.trim().toLocaleLowerCase('ar');
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(key)) return key;
  return COLOR_HEX[key] || '#b7b7b7';
}

export default function ProductDetails({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const availableColors = product.colors?.filter(Boolean) || [];
  const [selectedColor, setSelectedColor] = useState(availableColors[0] || '');
  const gallery = product.images?.length ? product.images : [product.image];
  const safeImageIndex = Math.min(activeImageIndex, gallery.length - 1);
  const activeImage = gallery[safeImageIndex] || product.image;
  const colorsSignature = availableColors.join('|');

  useEffect(() => {
    setSelectedColor(availableColors[0] || '');
    setActiveImageIndex(0);
  }, [product.id, colorsSignature]);

  useEffect(() => {
    if (gallery.length < 2) return;
    const timer = window.setTimeout(() => {
      setActiveImageIndex((current) => (current + 1) % gallery.length);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [gallery.length, activeImageIndex]);

  function handleAdd() {
    addToCart(product.id, quantity, selectedColor || undefined);
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
            {activeImage ? (
              <img
                key={safeImageIndex}
                src={activeImage}
                alt={product.name + ' - الصورة ' + (safeImageIndex + 1)}
                className="detail-image"
                fetchPriority="high"
              />
            ) : <div className="detail-no-image">صورة المنتج غير متاحة</div>}
            {gallery.length > 1 ? (
              <>
                <button
                  type="button"
                  className="detail-image-nav detail-image-previous"
                  onClick={() => setActiveImageIndex((current) => (current - 1 + gallery.length) % gallery.length)}
                  aria-label="الصورة السابقة"
                >›</button>
                <button
                  type="button"
                  className="detail-image-nav detail-image-next"
                  onClick={() => setActiveImageIndex((current) => (current + 1) % gallery.length)}
                  aria-label="الصورة التالية"
                >‹</button>
                <span className="detail-image-counter">{safeImageIndex + 1} / {gallery.length}</span>
              </>
            ) : null}
          </div>
          {gallery.length > 1 ? <div className="detail-thumbnails" aria-label="صور المنتج">
            {gallery.map((image, index) => <button type="button" className={index === safeImageIndex ? 'detail-thumbnail active' : 'detail-thumbnail'} key={image + index} onClick={() => setActiveImageIndex(index)} aria-label={'عرض الصورة ' + (index + 1)} aria-pressed={index === safeImageIndex}><img src={image} alt="" loading="lazy" /></button>)}
          </div> : null}
        </div>
        <div className="detail-information detail-glass-panel">
          <span className="product-category detail-category-chip"><span aria-hidden="true">▦</span>{product.category}</span>
          <div className="detail-product-summary">
            <div className="detail-product-name-card">
              <span className="detail-summary-label"><span aria-hidden="true">✦</span> المنتج</span>
              <h1>{product.name}</h1>
            </div>
            <div className="detail-product-price-card">
              <span className="detail-summary-label"><span aria-hidden="true">ر.س</span> السعر</span>
              <strong>{formatPrice(product.price)}</strong>
              {product.oldPrice ? <del>{formatPrice(product.oldPrice)}</del> : null}
            </div>
          </div>
          {product.shortDescription && product.shortDescription !== product.description ? <p className="detail-lead"><span aria-hidden="true">✦</span>{product.shortDescription}</p> : null}
          <div className="detail-rule" />
          {availableColors.length ? (
            <section className="detail-options detail-color-options" aria-label="اختيار لون المنتج">
              <div className="detail-option-heading"><h2><span aria-hidden="true">◉</span> اللون</h2><span className="detail-selected-color">{selectedColor ? 'اللون المختار: ' + selectedColor : 'اختر اللون'}</span></div>
              <div className="detail-color-swatches">
                {availableColors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={'detail-color-option' + (selectedColor === color ? ' is-selected' : '')}
                    onClick={() => setSelectedColor(color)}
                    aria-label={'اختيار اللون ' + color}
                    aria-pressed={selectedColor === color}
                    title={color}
                  >
                    <span className="detail-color-dot" style={{ backgroundColor: getColorHex(color) }} />
                    <span className="detail-color-name">{color}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {product.storageOptions?.length ? (
            <section className="detail-options"><div className="detail-option-heading"><h2><span aria-hidden="true">▣</span> مساحة التخزين</h2></div><div className="detail-option-chips">{product.storageOptions.map((storage) => <span key={storage}>{storage}</span>)}</div></section>
          ) : null}
          <section className="detail-copy-block">
            <h2><span aria-hidden="true">✧</span> نبذة عن المنتج</h2>
            <p className="detail-description">{product.description}</p>
          </section>
          {product.specifications.length ? (
            <section className="detail-spec-block">
              <h2><span aria-hidden="true">✓</span> تفاصيل ومميزات</h2>
              <ul className="spec-list">{product.specifications.map((specification) => <li key={specification}><span aria-hidden="true">✓</span>{specification}</li>)}</ul>
            </section>
          ) : null}
          <div className="detail-actions">
            <div className="quantity-control" aria-label="الكمية">
              <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="تقليل الكمية">−</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="زيادة الكمية">+</button>
            </div>
            <button type="button" className="primary-button detail-add-button" onClick={handleAdd}>{added ? '✓ تمت الإضافة' : <><span aria-hidden="true">＋</span> أضف إلى السلة</>}</button>
          </div>
          <p className="detail-storage-note"><span aria-hidden="true">♧</span> اختياراتك محفوظة في سلة المشتريات على هذا المتصفح.</p>
          <Link href="/cart" className="text-link">عرض سلة المشتريات <span aria-hidden="true">←</span></Link>
        </div>
      </div>
    </main>
  );
}
