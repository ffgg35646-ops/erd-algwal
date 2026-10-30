'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import styles from './cart.module.css';
import { parseCartItemKey, useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  );
}

export default function CartPage() {
  const { cart, hydrated, setQuantity, removeFromCart, catalogProducts: products, itemCount } = useCart();

  const lines = useMemo(
    () => Object.entries(cart).map(([cartKey, quantity]) => {
      const { productId, color } = parseCartItemKey(cartKey);
      return { cartKey, color, product: products.find((item) => item.id === productId), quantity };
    }).filter((line) => Boolean(line.product)),
    [cart, products]
  );

  const total = lines.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}><Link href="/">الرئيسية</Link><span>/</span><span>سلة الشراء</span></div>

      {!hydrated ? (
        <div className={styles.loading} role="status">جاري تحميل سلتك...</div>
      ) : lines.length === 0 ? (
        <section className={styles.empty} aria-labelledby="cart-empty-title">
          <div className={styles.emptyIcon}><CartIcon /></div>
          <h1 id="cart-empty-title">السلة فارغة</h1>
          <Link href="/#categories" className={styles.continueLink}>العودة للتسوق</Link>
        </section>
      ) : (
        <section className={styles.cart} aria-labelledby="cart-title">
          <div className={styles.cartHeading}>
            <div>
              <span className={styles.kicker}>اختياراتك محفوظة</span>
              <h1 id="cart-title">سلة الشراء</h1>
            </div>
            <span className={styles.countPill}>{itemCount} {itemCount === 1 ? 'قطعة' : 'قطع'}</span>
          </div>

          <div className={styles.items}>
            {lines.map(({ cartKey, color, product, quantity }) => product ? (
              <article className={styles.item} key={cartKey}>
                <Link href={'/products/' + product.id} className={styles.thumb} aria-label={'تفاصيل ' + product.name}>
                  <img src={product.image} alt={product.name} loading="lazy" />
                </Link>
                <div className={styles.info}>
                  <span className={styles.category}>{product.category}</span>
                  <Link href={'/products/' + product.id} className={styles.name}>{product.name}</Link>
                  {color ? <p className={styles.variant}>اللون: {color}</p> : null}
                  <div className={styles.price}>{formatPrice(product.price)}</div>
                  <div className={styles.itemActions}>
                    <div className={styles.quantity} aria-label="الكمية">
                      <button type="button" onClick={() => setQuantity(cartKey, quantity + 1)} aria-label={'زيادة كمية ' + product.name}>+</button>
                      <span aria-live="polite">{quantity}</span>
                      <button type="button" onClick={() => setQuantity(cartKey, quantity - 1)} aria-label={'تقليل كمية ' + product.name}>−</button>
                    </div>
                    <button type="button" className={styles.remove} onClick={() => removeFromCart(cartKey)}>حذف</button>
                  </div>
                </div>
              </article>
            ) : null)}
          </div>

          <aside className={styles.summary} aria-label="ملخص السلة">
            <div className={styles.summaryRow}><span>المجموع الفرعي</span><strong>{formatPrice(total)}</strong></div>
            <div className={styles.summaryRow}><span>الشحن</span><strong className={styles.shipping}>يحسب عند الدفع</strong></div>
            <div className={styles.summaryTotal}><span>الإجمالي</span><strong>{formatPrice(total)}</strong></div>
            <Link href="/checkout" className={styles.checkoutButton}>إتمام الطلب</Link>
            <Link href="/#categories" className={styles.continueButton}>العودة للتسوق</Link>
          </aside>
        </section>
      )}
    </main>
  );
}
