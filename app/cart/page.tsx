'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { parseCartItemKey, useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';

export default function CartPage() {
  const { cart, hydrated, setQuantity, removeFromCart, catalogProducts: products } = useCart();

  const lines = useMemo(
    () => Object.entries(cart).map(([cartKey, quantity]) => {
      const { productId, color } = parseCartItemKey(cartKey);
      return { cartKey, color, product: products.find((item) => item.id === productId), quantity };
    }).filter((line) => Boolean(line.product)),
    [cart]
  );

  const total = lines.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);

  return (
    <main className="container cart-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><span>سلة المشتريات</span></div>
      <div className="cart-page-heading"><div><span className="section-kicker">اختياراتك محفوظة</span><h1>سلة المشتريات</h1></div><Link href="/#products" className="text-link">مواصلة التسوق ←</Link></div>

      {!hydrated ? (
        <div className="cart-loading">جاري تحميل سلتك...</div>
      ) : lines.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg></div>
          <h2>سلتك لسه فاضية</h2>
          <p>تصفح المنتجات واضغط على علامة السلة لإضافة اللي يعجبك.</p>
          <Link href="/#products" className="primary-button">ابدأ التسوق</Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-items" aria-label="المنتجات في السلة">
            {lines.map(({ cartKey, color, product, quantity }) => product ? (
              <article className="cart-line" key={cartKey}>
                <Link href={'/products/' + product.id} className="cart-line-image"><img src={product.image} alt={product.name} loading="lazy" /></Link>
                <div className="cart-line-info">
                  <span className="product-category">{product.category}</span>
                  <Link href={'/products/' + product.id} className="cart-line-name">{product.name}</Link>
                  <strong>{formatPrice(product.price)}</strong>
                  {color ? <span className="cart-line-color">اللون: {color}</span> : null}
                  <button type="button" className="remove-line" onClick={() => removeFromCart(cartKey)}>حذف المنتج</button>
                </div>
                <div className="cart-line-controls">
                  <div className="quantity-control">
                    <button type="button" onClick={() => setQuantity(cartKey, quantity - 1)} aria-label="تقليل الكمية">−</button>
                    <span>{quantity}</span>
                    <button type="button" onClick={() => setQuantity(cartKey, quantity + 1)} aria-label="زيادة الكمية">+</button>
                  </div>
                  <strong className="line-total">{formatPrice(product.price * quantity)}</strong>
                </div>
              </article>
            ) : null)}
          </section>
          <aside className="cart-summary">
            <h2>ملخص السلة</h2>
            <div className="summary-row"><span>عدد القطع</span><strong>{lines.reduce((count, line) => count + line.quantity, 0)}</strong></div>
            <div className="summary-row"><span>قيمة المنتجات</span><strong>{formatPrice(total)}</strong></div>
            <div className="summary-divider" />
            <div className="summary-total"><span>الإجمالي</span><strong>{formatPrice(total)}</strong></div>
            <p className="cart-next-step">راجع بيانات السلة، ثم أكمل بيانات التوصيل لإرسال طلبك.</p>
            <div className="checkout-summary-actions"><Link href="/checkout" className="primary-button">إتمام الطلب <span aria-hidden="true">←</span></Link><Link href="/#products" className="outline-button summary-back">إضافة منتجات أخرى</Link></div>
          </aside>
        </div>
      )}
    </main>
  );
}
