'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useCart } from '@/components/CartProvider';
import { formatPrice, products } from '@/lib/products';

export default function CheckoutStartPage() {
  const { cart, hydrated } = useCart();

  const lines = useMemo(() => Object.entries(cart).map(([id, quantity]) => ({
    product: products.find((item) => item.id === id),
    quantity
  })).filter((line) => Boolean(line.product)), [cart]);

  const total = lines.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (!hydrated) {
    return <main className="container checkout-page"><div className="cart-loading">جاري تحميل سلة المشتريات...</div></main>;
  }

  return (
    <main className="container checkout-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><Link href="/cart">سلة المشتريات</Link><span>/</span><span>إتمام الطلب</span></div>
      <div className="checkout-topline">
        <div>
          <span className="section-kicker">خطوة إتمام الطلب</span>
          <h1>راجع طلبك قبل المتابعة</h1>
          <p>تأكد من المنتجات والكميات، وبعدها أدخل بيانات التواصل وعنوان التوصيل.</p>
        </div>
        <div className="checkout-step-indicator"><span>١</span><div><strong>مراجعة المنتجات</strong><small>الخطوة الأولى من ٢</small></div></div>
      </div>

      {!lines.length ? (
        <section className="checkout-empty">
          <div className="empty-cart-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg></div>
          <h2>سلتك فاضية</h2>
          <p>أضف المنتجات اللي تحتاجها، وبعدها ارجع لإتمام الطلب.</p>
          <Link href="/#products" className="primary-button">تصفح المنتجات</Link>
        </section>
      ) : (
        <div className="checkout-review-layout">
          <section className="checkout-review-card">
            <div className="checkout-review-heading"><div><span className="section-kicker">محتويات السلة</span><h2>المنتجات المختارة</h2></div><Link href="/cart" className="text-link">تعديل الكميات ←</Link></div>
            <div className="checkout-review-items">
              {lines.map(({ product, quantity }) => product ? (
                <article className="checkout-review-item" key={product.id}>
                  <Link href={'/products/' + product.id} className="checkout-review-image"><img src={product.image} alt={product.name} /></Link>
                  <div className="checkout-review-product"><span className="product-category">{product.category}</span><Link href={'/products/' + product.id}>{product.name}</Link><small>الكمية: {quantity}</small></div>
                  <strong>{formatPrice(product.price * quantity)}</strong>
                </article>
              ) : null)}
            </div>
            <div className="checkout-review-actions">
              <Link href="/cart" className="outline-button">العودة للسلة</Link>
              <Link href="/checkout/store" className="primary-button">متابعة لبيانات التوصيل <span aria-hidden="true">←</span></Link>
            </div>
          </section>
          <aside className="checkout-order-summary">
            <h2>ملخص الطلب</h2>
            <div className="checkout-total-row"><span>عدد القطع</span><strong>{count}</strong></div>
            <div className="checkout-total-row"><span>قيمة المنتجات</span><strong>{formatPrice(total)}</strong></div>
            <p className="checkout-shipping-note">تُحسب تفاصيل الشحن والدفع بعد استكمال بيانات التوصيل وتحديد آلية المتجر.</p>
            <div className="checkout-grand-total"><span>الإجمالي الحالي</span><strong>{formatPrice(total)}</strong></div>
            <div className="checkout-privacy-note"><span>♧</span><p>لا تحتاج إلى إنشاء حساب. سلتك محفوظة في نفس المتصفح.</p></div>
          </aside>
        </div>
      )}
    </main>
  );
}
