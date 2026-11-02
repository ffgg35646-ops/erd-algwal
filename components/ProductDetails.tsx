'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Product } from '@/lib/products';
import { formatPrice, getProductPrice } from '@/lib/products';
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
  'أزرق داكن': '#1d355c', 'ازرق داكن': '#1d355c',
  'جليدي': '#dce8f4', 'خمري': '#76263f',
  'برتقالي كوني': '#e87932', 'أزرق ضبابي': '#a9c4dd',
  'أخضر مريمي': '#97aa92', 'أبيض سحابي': '#f5f5f0',
  'ذهبي فاتح': '#d9c59e', 'وردي ناعم': '#f4cbd5',
  'أسود فضائي': '#292d37', 'تيتانيوم أسود': '#55565a',
  'تيتانيوم أبيض': '#e6e4df', 'تيتانيوم صحراوي': '#bfa58b',
  'أزرق سماوي': '#9dc8e9'
};

function getColorHex(color: string) {
  const key = color.trim().toLocaleLowerCase('ar');
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(key)) return key;
  return COLOR_HEX[key] || '#b7b7b7';
}

function getRgb(hex: string) {
  const value = hex.replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((part) => part + part).join('')
    : value;
  const number = Number.parseInt(normalized, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255
  };
}

function getHsl(color: string) {
  const { r, g, b } = getRgb(getColorHex(color));
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { hue, saturation, lightness };
}

/**
 * Uses the first product color as the source color represented by its single
 * uploaded image. CSS filters preserve the image's shading and need no extra
 * image files or canvas/CORS access.
 */
function getProductImageColorFilter(sourceColor: string, selectedColor: string) {
  if (!sourceColor || !selectedColor || sourceColor === selectedColor) return 'none';

  const source = getHsl(sourceColor);
  const target = getHsl(selectedColor);

  // Neutral variants have no meaningful hue to rotate.
  if (target.saturation < 0.1) return 'grayscale(1)';

  // A neutral source needs a small sepia base before its hue can be shifted.
  if (source.saturation < 0.1) {
    const hueShift = target.hue - 38;
    const saturation = Math.min(3.2, Math.max(1.8, target.saturation * 3));
    return `sepia(.85) saturate(${saturation.toFixed(2)}) hue-rotate(${hueShift.toFixed(1)}deg)`;
  }

  const hueShift = target.hue - source.hue;
  const saturation = Math.min(1.6, Math.max(0.65, target.saturation / source.saturation));
  return `hue-rotate(${hueShift.toFixed(1)}deg) saturate(${saturation.toFixed(2)})`;
}

function ProductCartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  );
}

export default function ProductDetails({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart, itemCount } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const availableColors = product.colors?.filter(Boolean) || [];
  const availableStorage = product.storageOptions?.filter(Boolean) || [];
  const [selectedColor, setSelectedColor] = useState(availableColors[0] || '');
  const [selectedStorage, setSelectedStorage] = useState(availableStorage[0] || '');
  const gallery = product.images?.length ? product.images : [product.image];
  const safeImageIndex = Math.min(activeImageIndex, gallery.length - 1);
  const activeImage = gallery[safeImageIndex] || product.image;
  const imageColorFilter = getProductImageColorFilter(availableColors[0] || '', selectedColor);
  const colorsSignature = availableColors.join('|');
  const storageSignature = availableStorage.join('|');
  const selectedPrice = getProductPrice(product, selectedStorage);
  const hasStoragePrice = Boolean(selectedStorage && product.storagePrices?.[selectedStorage]);

  useEffect(() => {
    setSelectedColor(availableColors[0] || '');
    setSelectedStorage(availableStorage[0] || '');
    setActiveImageIndex(0);
  }, [product.id, colorsSignature, storageSignature]);

  useEffect(() => {
    if (gallery.length < 2) return;
    const timer = window.setTimeout(() => {
      setActiveImageIndex((current) => (current + 1) % gallery.length);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [gallery.length, activeImageIndex]);

  function handleAdd() {
    addToCart(product.id, quantity, selectedColor || undefined, selectedStorage || undefined);
    router.push('/cart');
  }

  return (
    <main className="container product-detail-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><Link href="/#categories">المنتجات</Link><span>/</span><span>{product.name}</span></div>

      <article className="product-detail-card">
        <div className="product-detail-hero">
          {product.badge ? <span className="product-detail-badge">{product.badge}</span> : null}
          {activeImage ? (
            <img
              key={safeImageIndex}
              src={activeImage}
              alt={product.name + ' - الصورة ' + (safeImageIndex + 1)}
              className="product-detail-image"
              style={{ filter: imageColorFilter, transition: 'filter 220ms ease' }}
              fetchPriority="high"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = '/product-image-placeholder.svg';
              }}
            />
          ) : <div className="detail-no-image">صورة المنتج غير متاحة</div>}
          {gallery.length > 1 ? (
            <>
              <button type="button" className="product-detail-image-nav is-previous" onClick={() => setActiveImageIndex((current) => (current - 1 + gallery.length) % gallery.length)} aria-label="الصورة السابقة">›</button>
              <button type="button" className="product-detail-image-nav is-next" onClick={() => setActiveImageIndex((current) => (current + 1) % gallery.length)} aria-label="الصورة التالية">‹</button>
              <span className="product-detail-image-count">{safeImageIndex + 1} / {gallery.length}</span>
            </>
          ) : null}
        </div>

        {gallery.length > 1 ? (
          <div className="product-detail-thumbnails" aria-label="صور المنتج">
            {gallery.map((image, index) => (
              <button type="button" className={index === safeImageIndex ? 'is-active' : ''} key={image + index} onClick={() => setActiveImageIndex(index)} aria-label={'عرض الصورة ' + (index + 1)} aria-pressed={index === safeImageIndex}>
                <img src={image} alt="" loading="lazy" style={{ filter: imageColorFilter, transition: 'filter 220ms ease' }} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/product-image-placeholder.svg'; }} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="product-detail-content">
          <div className="product-detail-badges">
            <span className="product-detail-category">{product.category}</span>
            <span className="product-detail-note">تفاصيل المنتج وخياراته</span>
          </div>
          <h1>{product.name}</h1>
          {product.shortDescription && product.shortDescription !== product.description && product.shortDescription.trim() !== 'اختيار عملي للاستخدام اليومي.' ? (
            <p className="product-detail-lead">{product.shortDescription}</p>
          ) : null}

          {availableColors.length ? (
            <section className="product-detail-option">
              <div className="product-detail-option-heading">
                <h2>الألوان:</h2>
              </div>
              <div className="product-detail-colors">
                {availableColors.map((color) => (
                  <button type="button" key={color} className={'product-detail-color' + (selectedColor === color ? ' is-selected' : '')} onClick={() => setSelectedColor(color)} aria-label={'اختيار اللون ' + color} aria-pressed={selectedColor === color} title={color}>
                    <span className="product-detail-color-dot" style={{ backgroundColor: getColorHex(color) }} />
                    <span>{color}</span>
                  </button>
                ))}
              </div>
              <div className="product-detail-selected">الألوان المختارة: <b>{selectedColor || '—'}</b></div>
            </section>
          ) : null}

          {availableStorage.length ? (
            <section className="product-detail-option">
              <div className="product-detail-option-heading">
                <h2>مساحة التخزين:</h2>
              </div>
              <div className="product-detail-storage-options">
                {availableStorage.map((storage) => (
                  <button type="button" key={storage} className={selectedStorage === storage ? 'is-selected' : ''} onClick={() => setSelectedStorage(storage)} aria-pressed={selectedStorage === storage}>
                    <span>{storage}</span>
                  </button>
                ))}
              </div>
              <div className="product-detail-selected">مساحة التخزين المختارة: <b>{selectedStorage || '—'}</b></div>
            </section>
          ) : null}

          <section className="product-detail-purchase">
            <div className="product-detail-price">
              <span>السعر</span>
              <strong>{formatPrice(selectedPrice)}</strong>
              {!hasStoragePrice && product.oldPrice ? <del>{formatPrice(product.oldPrice)}</del> : null}
            </div>
            <div className="product-detail-quantity" aria-label="الكمية">
              <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="تقليل الكمية">−</button>
              <span aria-live="polite">{quantity}</span>
              <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="زيادة الكمية">+</button>
            </div>
          </section>

          <div className="product-detail-actions-row">
            <button type="button" className="product-detail-add" onClick={handleAdd}>
              متابعة الطلب
            </button>
            <Link href="/cart" className="product-detail-cart-button" aria-label="فتح سلة المشتريات" title="فتح سلة المشتريات">
              <ProductCartIcon />
              {itemCount > 0 ? <span className="product-detail-cart-count">{itemCount > 99 ? '99+' : itemCount}</span> : null}
            </Link>
          </div>

          <section className="product-detail-description">
            <h2>الوصف</h2>
            <p>{product.description}</p>
          </section>

          {product.specifications.length ? (
            <section className="product-detail-specifications">
              <h2>تفاصيل ومميزات</h2>
              <ul>{product.specifications.map((specification) => <li key={specification}>{specification}</li>)}</ul>
            </section>
          ) : null}
        </div>
      </article>
    </main>
  );
}
