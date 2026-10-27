'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';

type CheckoutDraft = {
  orderId?: string;
  orderNumber?: string;
  notificationSent?: boolean;
  fullName?: string;
  phone?: string;
  email?: string;
  region?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  building?: string;
  notes?: string;
  installment?: 'yes' | 'no';
  acceptedPolicies?: boolean;
};

export default function CheckoutPaymentPage() {
  const { cart, hydrated, catalogProducts: products } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
      if (raw) setDraft(JSON.parse(raw) as CheckoutDraft);
    } catch {
      setDraft(null);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  const lines = useMemo(() => Object.entries(cart).map(([id, quantity]) => ({
    product: products.find((item) => item.id === id),
    quantity
  })).filter((line) => Boolean(line.product)), [cart]);

  const total = lines.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  function handlePay() {
    setPaymentMessage('بوابة الدفع الإلكتروني لم تُربط بعد. لم يتم إرسال بيانات بطاقة أو خصم أي مبلغ. ستُفعّل هذه الخطوة بعد اختيار وربط مزود دفع آمن.');
  }

  if (!hydrated || !draftLoaded) {
    return <main className="container checkout-page"><div className="cart-loading">جاري تحميل بيانات الطلب...</div></main>;
  }

  if (!draft || !draft.fullName || !draft.acceptedPolicies || !lines.length) {
    return (
      <main className="container checkout-page">
        <section className="checkout-empty">
          <div className="empty-cart-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v4m0 4h.01M5 3h14v18H5z" /></svg></div>
          <h2>أكمل بيانات الطلب أولًا</h2>
          <p>نحتاج بيانات التوصيل ومحتويات السلة قبل الانتقال إلى خطوة الدفع.</p>
          <Link href="/checkout/store" className="primary-button">العودة لبيانات التوصيل</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container checkout-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><Link href="/checkout/store">إنهاء الطلب</Link><span>/</span><span>طرق الدفع</span></div>
      <div className="checkout-topline">
        <div>
          <span className="section-kicker">الخطوة الثانية من إتمام الطلب</span>
          <h1>طريقة الدفع</h1>
          <p>راجع المبلغ المستحق، ثم أكمل الدفع من خلال بوابة دفع آمنة.</p>
          {draft.orderNumber ? <p className="checkout-order-number">رقم الطلب: <strong>{draft.orderNumber}</strong></p> : null}
        </div>
        <div className="checkout-step-indicator"><span>٢</span><div><strong>طرق الدفع</strong><small>الخطوة الثانية من ٢</small></div></div>
      </div>

      <div className="checkout-layout payment-layout">
        <section className="checkout-form-card payment-form-card">
          <div className="checkout-section-heading"><span className="checkout-section-number">٢</span><div><h2>طريقة الدفع</h2><p>بيانات البطاقة تُدخل داخل صفحة مزود الدفع عند تفعيله فقط.</p></div></div>

          <div className="payment-method-selected">
            <span className="payment-method-radio" aria-hidden="true"><span /></span>
            <div className="payment-method-copy"><strong>بطاقة بنكية</strong><small>مدى أو البطاقة المدعومة من مزود الدفع المختار</small></div>
            <div className="payment-brand-list" aria-label="بطاقة بنكية"><span>mada</span><span>VISA</span><span>MC</span></div>
          </div>

          <div className="payment-secure-panel">
            <div className="payment-secure-heading"><span className="secure-lock">⌑</span><div><strong>تسوق إلكتروني آمن</strong><small>حماية بيانات الدفع عبر مزود متخصص</small></div></div>
            <p>في صفحة الدفع الفعلية، سيطلب مزود الدفع اسم حامل البطاقة ورقم البطاقة ورمز CVV. لن يحفظ متجر أرض الجوال هذه البيانات في MongoDB أو في المتصفح، ولن تُرسل إلى بوت تيليجرام.</p>
            <div className="payment-field-preview">
              <div><span>اسم حامل البطاقة</span><b>يُدخل في بوابة الدفع الآمنة</b></div>
              <div><span>رقم البطاقة</span><b>يُدخل في بوابة الدفع الآمنة</b></div>
              <div><span>رمز (CVV)</span><b>يُدخل في بوابة الدفع الآمنة</b></div>
            </div>
            <span className="payment-pending-tag"><span /> بوابة الدفع قيد الربط</span>
          </div>

          {draft.notificationSent === false ? (
            <div className="checkout-alert checkout-alert-error" role="status">
              <span>!</span><div><strong>تم تسجيل الطلب، لكن إشعار تيليجرام لم يُرسل.</strong><p>رقم الطلب محفوظ ويمكن مراجعته من قسم «طلبات العملاء» بعد تفعيل البوت.</p></div>
            </div>
          ) : null}

          {draft.installment === 'yes' ? (
            <div className="checkout-alert checkout-alert-error"><span>!</span><div><strong>طلب تقسيط محدد</strong><p>اختيار التقسيط محفوظ، لكن مزود التقسيط وشروطه لم يتم تحديدهما بعد. لا تُعرض خطة أو أقساط فعلية قبل ربط المزود.</p></div></div>
          ) : null}

          {paymentMessage ? <div className="checkout-alert checkout-alert-error" role="alert"><span>!</span>{paymentMessage}</div> : null}

          <div className="checkout-form-actions payment-actions">
            <Link href="/checkout/store" className="outline-button">الرجوع لبيانات التوصيل</Link>
            <button type="button" className="primary-button checkout-submit" onClick={handlePay}>إكمال الدفع <span aria-hidden="true">←</span></button>
          </div>
        </section>

        <aside className="checkout-order-summary">
          <h2>ملخص الطلب</h2>
          <div className="payment-customer-summary">
            <div><small>الاسم الكامل</small><strong>{draft.fullName}</strong></div>
            <div><small>رقم الجوال</small><strong dir="ltr">{draft.phone || '—'}</strong></div>
            <div><small>عنوان التوصيل</small><strong>{[draft.neighborhood, draft.city, draft.region].filter(Boolean).join('، ') || '—'}</strong></div>
          </div>
          <div className="checkout-order-items">
            {lines.map(({ product, quantity }) => product ? (
              <div className="checkout-order-item" key={product.id}>
                <img src={product.image} alt={product.name} />
                <div><strong>{product.name}</strong><small>الكمية: {quantity}</small></div>
                <b>{formatPrice(product.price * quantity)}</b>
              </div>
            ) : null)}
          </div>
          <div className="checkout-total-row"><span>عدد القطع</span><strong>{itemCount}</strong></div>
          <div className="checkout-total-row"><span>الشحن والتوصيل</span><strong>يُحدد لاحقًا</strong></div>
          <div className="checkout-grand-total"><span>المبلغ المستحق حاليًا</span><strong>{formatPrice(total)}</strong></div>
          <p className="checkout-shipping-note">المبلغ المعروض يساوي قيمة المنتجات فقط؛ قد يتغير بعد تحديد تكلفة الشحن وأي رسوم معلنة قبل الدفع.</p>
          <Link href="/checkout/store" className="checkout-edit-cart">تعديل بيانات التوصيل ←</Link>
        </aside>
      </div>
    </main>
  );
}
