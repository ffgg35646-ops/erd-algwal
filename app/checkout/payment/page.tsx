'use client';

import Link from 'next/link';
import styles from '../checkout.module.css';
import { useEffect, useMemo, useState } from 'react';
import { parseCartItemKey, useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';

type CheckoutDraft = {
  orderId?: string;
  orderNumber?: string;
  submissionId?: string;
  paymentMethod?: 'mada' | 'visa';
  notificationSent?: boolean;
  fullName?: string;
  phone?: string;
  email?: string;
  region?: string;
  city?: string;
  addressDetails?: string;
  neighborhood?: string;
  street?: string;
  building?: string;
  notes?: string;
  installment?: 'yes' | 'no';
  installmentDownPayment?: number;
  installmentMonths?: number;
  acceptedPolicies?: boolean;
};

export default function CheckoutPaymentPage() {
  const { cart, hydrated, catalogProducts: products } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'visa'>('mada');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

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

  const lines = useMemo(() => Object.entries(cart).map(([cartKey, quantity]) => {
    const { productId, color } = parseCartItemKey(cartKey);
    return { cartKey, color, product: products.find((item) => item.id === productId), quantity };
  }).filter((line) => Boolean(line.product)), [cart]);

  const total = lines.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  async function handlePay() {
    if (paymentSubmitting) return;
    if (!draft?.orderId || !draft.submissionId) {
      setPaymentMessage('بيانات الطلب غير مكتملة. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      return;
    }
    let reviewToken = '';
    try {
      reviewToken = window.localStorage.getItem('erd-algwal-review-token') || '';
    } catch {
      reviewToken = '';
    }
    if (!reviewToken) {
      setPaymentMessage('تعذر التحقق من الطلب. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      return;
    }

    setPaymentSubmitting(true);
    setPaymentMessage('');
    try {
      const response = await fetch('/api/orders/payment-method', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: draft.orderId,
          submissionId: draft.submissionId,
          reviewToken,
          paymentMethod
        })
      });
      const result = await response.json() as { ok?: boolean; notificationSent?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'تعذر إرسال اختيار طريقة الدفع إلى الإدارة.');
      }

      const methodLabel = paymentMethod === 'mada' ? 'مدى' : 'Visa';
      setDraft((current) => current ? { ...current, paymentMethod } : current);
      setPaymentMessage(result.notificationSent
        ? `تم إرسال اختيار ${methodLabel} وبيانات الطلب إلى الإدارة. الدفع لم يُنفذ بعد لأن بوابة الدفع الإلكتروني لم تُربط.`
        : `تم حفظ اختيار ${methodLabel} في الطلب، لكن تعذر إرسال إشعار تيليجرام للإدارة. لم يتم خصم أي مبلغ.`);
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'تعذر إرسال اختيار طريقة الدفع.');
    } finally {
      setPaymentSubmitting(false);
    }
  }

  if (!hydrated || !draftLoaded) {
    return <main className={`${styles.checkoutShell} container checkout-page`}><div className="cart-loading">جاري تحميل بيانات الطلب...</div></main>;
  }

  if (!draft || !draft.fullName || !draft.acceptedPolicies || !lines.length) {
    return (
      <main className={`${styles.checkoutShell} container checkout-page`}>
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
    <main className={`${styles.checkoutShell} container checkout-page`}>
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><Link href="/checkout/store">إنهاء الطلب</Link><span>/</span><span>طرق الدفع</span></div>
      <div className="checkout-topline">
        <div>
          <span className="section-kicker">الخطوة الثانية من إتمام الطلب</span>
          <h1>طريقة الدفع</h1>
          {draft.orderNumber ? <p className="checkout-order-number">رقم الطلب: <strong>{draft.orderNumber}</strong></p> : null}
        </div>
        <div className="checkout-step-indicator"><span>٢</span><div><strong>طرق الدفع</strong><small>الخطوة الثانية من ٢</small></div></div>
      </div>

      <div className="checkout-layout payment-layout">
        <section className="checkout-form-card payment-form-card">
          <div className="checkout-section-heading"><div><h2>طريقة الدفع</h2></div></div>

          <div className="payment-method-options" role="group" aria-label="اختيار طريقة البطاقة">
            <button type="button" className={paymentMethod === 'visa' ? 'payment-method-choice selected' : 'payment-method-choice'} aria-pressed={paymentMethod === 'visa'} onClick={() => { setPaymentMethod('visa'); setPaymentMessage(''); }}>
              <span className="payment-method-name">Visa</span>
            </button>
            <button type="button" className={paymentMethod === 'mada' ? 'payment-method-choice selected' : 'payment-method-choice'} aria-pressed={paymentMethod === 'mada'} onClick={() => { setPaymentMethod('mada'); setPaymentMessage(''); }}>
              <span className="payment-method-name">مدى</span>
            </button>
          </div>

          <p className="payment-pending-note">اختيار البطاقة يُسجّل كطريقة دفع مفضلة فقط. لن يتم خصم أي مبلغ قبل ربط بوابة الدفع.</p>
          <div className="payment-amount-bar">
            <span>المبلغ المستحق</span>
            <strong>{formatPrice(total)}</strong>
          </div>

          {draft.notificationSent === false ? (
            <div className="checkout-alert checkout-alert-error" role="status">
              <span>!</span><div><strong>تم تسجيل الطلب، لكن إشعار تيليجرام لم يُرسل.</strong><p>رقم الطلب محفوظ ويمكن مراجعته من قسم «طلبات العملاء» بعد تفعيل البوت.</p></div>
            </div>
          ) : null}

          {draft.installment === 'yes' ? (
            <div className="checkout-alert checkout-alert-error"><span>!</span><div><strong>طلب تقسيط محدد</strong><p>الدفعة المقدمة: {Number(draft.installmentDownPayment || 0).toLocaleString('en-US')} ريال — المدة: {draft.installmentMonths || '—'} شهور. يتم تأكيد الشروط عند تفعيل مزود التقسيط.</p></div></div>
          ) : null}

          {paymentMessage ? <div className="payment-feedback" role="status">{paymentMessage}</div> : null}

          <div className="checkout-form-actions payment-actions">
            <Link href="/checkout/store" className="outline-button">الرجوع لبيانات التوصيل</Link>
            <button type="button" className="primary-button checkout-submit" onClick={handlePay} disabled={paymentSubmitting}>{paymentSubmitting ? 'جارٍ إرسال الطلب...' : 'إكمال الدفع'} <span aria-hidden="true">←</span></button>
          </div>
        </section>

        <aside className="checkout-order-summary">
          <h2>ملخص الطلب</h2>
          <div className="payment-customer-summary">
            <div><small>الاسم الكامل</small><strong>{draft.fullName}</strong></div>
            <div><small>رقم الجوال</small><strong dir="ltr">{draft.phone || '—'}</strong></div>
            <div><small>عنوان التوصيل</small><strong>{[draft.city, draft.addressDetails, draft.neighborhood, draft.street, draft.building].filter(Boolean).join('، ') || '—'}</strong></div>
          </div>
          <div className="checkout-order-items">
            {lines.map(({ cartKey, product, color, quantity }) => product ? (
              <div className="checkout-order-item" key={cartKey}>
                <img src={product.image} alt={product.name} />
                <div><strong>{product.name}</strong>{color ? <small>اللون: {color}</small> : null}<small>الكمية: {quantity}</small></div>
                <b>{formatPrice(product.price * quantity)}</b>
              </div>
            ) : null)}
          </div>
          <div className="checkout-total-row"><span>عدد القطع</span><strong>{itemCount}</strong></div>
          <div className="checkout-total-row"><span>الشحن والتوصيل</span><strong>يُحدد لاحقًا</strong></div>
          
          <p className="checkout-shipping-note">المبلغ المعروض يساوي قيمة المنتجات فقط؛ قد يتغير بعد تحديد تكلفة الشحن وأي رسوم معلنة قبل الدفع.</p>
          <Link href="/checkout/store" className="checkout-edit-cart">تعديل بيانات التوصيل ←</Link>
        </aside>
      </div>
    </main>
  );
}
