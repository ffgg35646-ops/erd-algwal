'use client';

import Link from 'next/link';
import styles from '../checkout.module.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseCartItemKey, useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';

type CheckoutDraft = {
  orderId?: string;
  orderNumber?: string;
  submissionId?: string;
  total?: number;
  currency?: string;
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

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const EXPIRY_YEARS = Array.from({ length: 15 }, (_, index) => String(new Date().getFullYear() + index));

export default function CheckoutPaymentPage() {
  const { cart, hydrated, catalogProducts: products } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'visa'>('mada');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [showRequiredMessage, setShowRequiredMessage] = useState(false);
  const paymentFieldsRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
      if (raw) {
        const saved = JSON.parse(raw) as CheckoutDraft;
        setDraft(saved);
        if (saved.paymentMethod === 'mada' || saved.paymentMethod === 'visa') setPaymentMethod(saved.paymentMethod);
      }
    } catch {
      setDraft(null);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  const lines = useMemo(() => Object.entries(cart).map(([cartKey, quantity]) => {
    const { productId, color } = parseCartItemKey(cartKey);
    return { cartKey, color, product: products.find((item) => item.id === productId), quantity };
  }).filter((line) => Boolean(line.product)), [cart, products]);

  const cartTotal = lines.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);
  const total = typeof draft?.total === 'number' && Number.isFinite(draft.total) ? draft.total : cartTotal;

  async function handlePay() {
    if (paymentSubmitting) return;
    if (!paymentFieldsRef.current?.checkValidity()) {
      setShowRequiredMessage(true);
      return;
    }
    setShowRequiredMessage(false);
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

    const cardholderNameInput = paymentFieldsRef.current?.elements.namedItem('cardholderName');
    const cardholderName = cardholderNameInput instanceof HTMLInputElement ? cardholderNameInput.value.trim().slice(0, 100) : '';
    if (!cardholderName) {
      setShowRequiredMessage(true);
      setPaymentMessage('يرجى كتابة اسم حامل البطاقة.');
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
          paymentMethod,
          cardholderName
        })
      });
      const result = await response.json() as { ok?: boolean; notificationSent?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'تعذر إرسال الطلب إلى الإدارة.');
      }

      setDraft((current) => current ? { ...current, paymentMethod } : current);
      const methodLabel = paymentMethod === 'mada' ? 'مدى' : 'Visa';
      setPaymentMessage(result.notificationSent
        ? `تم إرسال بيانات الطلب واختيار ${methodLabel} إلى الإدارة. لم يتم تنفيذ خصم إلكتروني لأن بوابة الدفع لم تُربط بعد.`
        : `تم حفظ الطلب واختيار ${methodLabel}، لكن تعذر إرسال إشعار تيليجرام للإدارة. لم يتم خصم أي مبلغ.`);
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'تعذر إرسال الطلب.');
    } finally {
      setPaymentSubmitting(false);
    }
  }

  if (!hydrated || !draftLoaded) {
    return (
      <main className={`${styles.checkoutShell} ${styles.paymentPageShell} payment-design-page`}>
        <div className={styles.paymentTopBand}>
          <div className={styles.paymentCard}>
            <div className={styles.paymentStep}><span>طريقة الدفع</span><hr /><i>2</i></div>
            <p>جاري تحميل بيانات الطلب...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!draft || !draft.fullName || !draft.acceptedPolicies || !lines.length) {
    return (
      <main className={`${styles.checkoutShell} ${styles.paymentPageShell} payment-design-page`}>
        <div className={styles.paymentTopBand}>
          <section className={styles.paymentCard}>
            <div className={styles.paymentStep}><span>طريقة الدفع</span><hr /><i>2</i></div>
            <h1 className={styles.paymentEmptyTitle}>أكمل بيانات الطلب أولًا</h1>
            <p className={styles.paymentEmptyText}>نحتاج بيانات التوصيل ومحتويات السلة قبل الانتقال إلى خطوة الدفع.</p>
            <Link href="/checkout/store" className={styles.paymentSubmit}>العودة لبيانات التوصيل ←</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.checkoutShell} ${styles.paymentPageShell} payment-design-page`}>
      <div className={styles.paymentTopBand}>
        <section className={styles.paymentCard} aria-label="نموذج الدفع">
          <div className={styles.paymentStep}>
            <span>طريقة الدفع</span>
            <hr />
            <i>2</i>
          </div>

          <div className={styles.paymentMethods} role="group" aria-label="اختيار طريقة الدفع">
            <button
              type="button"
              className={paymentMethod === 'mada' ? `${styles.paymentMethod} ${styles.paymentMethodSelected}` : styles.paymentMethod}
              aria-label="الدفع بمدى"
              aria-pressed={paymentMethod === 'mada'}
              onClick={() => { setPaymentMethod('mada'); setPaymentMessage(''); }}
            >
              <span className={styles.madaLogo}>مدى<br />mada<span className={styles.madaLogoUnderline} /></span>
            </button>
            <button
              type="button"
              className={paymentMethod === 'visa' ? `${styles.paymentMethod} ${styles.paymentMethodSelected}` : styles.paymentMethod}
              aria-label="الدفع بفيزا"
              aria-pressed={paymentMethod === 'visa'}
              onClick={() => { setPaymentMethod('visa'); setPaymentMessage(''); }}
            >
              <span className={styles.visaLogo}><i>VISA</i><b className={styles.visaCircleRed} /><b className={styles.visaCircleYellow} /></span>
            </button>
          </div>

          <div className={styles.paymentAmount}>المبلغ المستحق : {formatPrice(total)}</div>

          {/* Only the cardholder name is sent to the admin. Card number, expiry and CVV are never read or submitted.
              Replace these visual fields with the payment provider's hosted secure fields before enabling card payments. */}
          <form ref={paymentFieldsRef} className={styles.paymentFields} aria-label="بيانات البطاقة" onInput={(event) => { if (showRequiredMessage) setShowRequiredMessage(!event.currentTarget.checkValidity()); }}>
            <input className={styles.paymentInput} name="cardholderName" type="text" placeholder="إسم حامل البطاقة" aria-label="اسم حامل البطاقة" autoComplete="off" maxLength={100} required />
            <input className={styles.paymentInput} name="visa" type="text" placeholder="رقم البطاقة" aria-label="رقم البطاقة" inputMode="numeric" autoComplete="off" required />
           <div className={styles.paymentExpiryRow}>
  <label className={styles.paymentExpiryBox}>
    <span className={styles.visuallyHidden}>شهر الانتهاء</span>
    <select
      name="expiryMonth"
      aria-label="شهر الانتهاء"
      defaultValue=""
      required
    >
      <option value="" disabled>⌄</option>
      {MONTHS.map((month) => (
        <option key={month} value={month}>{month}</option>
      ))}
    </select>
  </label>

  <label className={styles.paymentExpiryBox}>
    <span className={styles.visuallyHidden}>سنة الانتهاء</span>
    <select
      name="expiryYear"
      aria-label="سنة الانتهاء"
      defaultValue=""
      required
    >
      <option value="" disabled>⌄</option>
      {EXPIRY_YEARS.map((year) => (
        <option key={year} value={year}>{year.slice(-2)}</option>
      ))}
    </select>
  </label>
              <input className={`${styles.paymentInput} ${styles.paymentCvv}`} type="password" placeholder="رمز" aria-label="رمز البطاقة" inputMode="numeric" autoComplete="off" required />
            </div>
          </form>

          {showRequiredMessage ? <div className={styles.paymentInlineMessage} role="alert">يرجى إكمال البيانات</div> : null}
          {paymentMessage ? <div className={styles.paymentInlineMessage} role="status">{paymentMessage}</div> : null}

          <div className={styles.paymentSafe}>تسوق إلكتروني</div>

          <button type="button" className={styles.paymentSubmit} onClick={handlePay} disabled={paymentSubmitting}>
            {paymentSubmitting ? 'جارٍ إرسال الطلب...' : 'إكمال الدفع'} <span aria-hidden="true">←</span>
          </button>
        </section>
      </div>
    </main>
  );
}
