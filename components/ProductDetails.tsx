'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CaseColorImage from '@/components/CaseColorImage';
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

export default function ProductDetails({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const availableColors = product.colors?.filter(Boolean) || [];
  const availableStorage = product.storageOptions?.filter(Boolean) || [];
  const imageSourceColor = product.colorMask?.sourceColor || availableColors[0] || '';
  const initialColor = availableColors.includes(imageSourceColor) ? imageSourceColor : (availableColors[0] || '');
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [selectedStorage, setSelectedStorage] = useState(availableStorage[0] || '');
  const baseGallery = product.images?.length ? product.images : [product.image];
  const selectedColorImage = selectedColor ? product.colorImages?.[selectedColor] || '' : '';
  const gallery = selectedColorImage
    ? [selectedColorImage, ...baseGallery.slice(1)]
    : baseGallery;
  const safeImageIndex = Math.min(activeImageIndex, gallery.length - 1);
  const activeImage = gallery[safeImageIndex] || product.image;
  const colorsSignature = availableColors.join('|');
  const storageSignature = availableStorage.join('|');
  const selectedPrice = getProductPrice(product, selectedStorage);
  const hasStoragePrice = Boolean(selectedStorage && product.storagePrices?.[selectedStorage]);

  useEffect(() => {
    setSelectedColor(initialColor);
    setSelectedStorage(availableStorage[0] || '');
    setActiveImageIndex(0);
  }, [product.id, colorsSignature, storageSignature, imageSourceColor]);

  useEffect(() => {
    // A generated case mask belongs to the main photo only; do not rotate
    // automatically to an unmasked gallery image after the customer picks a color.
    if (selectedColorImage || product.colorMask || gallery.length < 2) return;
    const timer = window.setTimeout(() => {
      setActiveImageIndex((current) => (current + 1) % gallery.length);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [gallery.length, activeImageIndex, product.colorMask, selectedColorImage]);

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
            safeImageIndex === 0 && product.colorMask && !selectedColorImage ? (
              <CaseColorImage
                key={activeImage}
                src={activeImage}
                alt={product.name + ' - الصورة ' + (safeImageIndex + 1)}
                className="product-detail-image"
                mask={product.colorMask}
                selectedColor={selectedColor || product.colorMask.sourceColor}
              />
            ) : (
              <img
                key={safeImageIndex}
                src={activeImage}
                alt={product.name + ' - الصورة ' + (safeImageIndex + 1)}
                className="product-detail-image"
                fetchPriority="high"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = '/product-image-placeholder.svg';
                }}
              />
            )
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
                {index === 0 && product.colorMask && !selectedColorImage ? (
                  <CaseColorImage
                    key={image}
                    src={image}
                    alt=""
                    mask={product.colorMask}
                    selectedColor={selectedColor || product.colorMask.sourceColor}
                  />
                ) : (
                  <img src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/product-image-placeholder.svg'; }} />
                )}
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
                  <button type="button" key={color} className={'product-detail-color' + (selectedColor === color ? ' is-selected' : '')} onClick={() => { setSelectedColor(color); setActiveImageIndex(0); }} aria-label={'اختيار اللون ' + color} aria-pressed={selectedColor === color} title={color}>
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
