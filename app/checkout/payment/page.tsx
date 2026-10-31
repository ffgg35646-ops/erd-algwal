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
  total?: number;
  currency?: string;
  paymentMethod?: 'mada' | 'visa';
  paymentNotificationSent?: boolean;
  notificationSent?: boolean;
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  addressDetails?: string;
  installment?: 'yes' | 'no';
  installmentDownPayment?: number;
  installmentMonths?: number;
  acceptedPolicies?: boolean;
};

function confirmationMessage(method: 'mada' | 'visa') {
  return `تم إرسال بيانات الطلب واختيار ${method === 'mada' ? 'مدى' : 'Visa'} إلى الإدارة.`;
}

export default function CheckoutPaymentPage() {
  const { cart, hydrated, catalogProducts: products } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'visa'>('mada');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
      if (raw) {
        const saved = JSON.parse(raw) as CheckoutDraft;
        setDraft(saved);
        if (saved.paymentMethod === 'mada' || saved.paymentMethod === 'visa') {
          setPaymentMethod(saved.paymentMethod);
        }
        if (saved.paymentNotificationSent === true && (saved.paymentMethod === 'mada' || saved.paymentMethod === 'visa')) {
          setPaymentSubmitted(true);
          setPaymentMessage(confirmationMessage(saved.paymentMethod));
        }
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

  async function handleCompleteOrder() {
    if (paymentSubmitting || paymentSubmitted) return;
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
      const result = await response.json() as {
        ok?: boolean;
        notificationSent?: boolean;
        paymentMethod?: 'mada' | 'visa';
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'تعذر إرسال الطلب إلى الإدارة.');
      }

      const notified = result.notificationSent === true;
      const savedMethod = result.paymentMethod === 'visa' ? 'visa' : paymentMethod;
      const updatedDraft: CheckoutDraft = {
        ...draft,
        paymentMethod: savedMethod,
        paymentNotificationSent: notified,
        notificationSent: notified
      };
      setDraft(updatedDraft);
      try {
        window.sessionStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify(updatedDraft));
      } catch {
        // Keep the confirmation visible even when session storage is unavailable.
      }

      setPaymentSubmitted(notified);
      setPaymentMessage(notified
        ? confirmationMessage(savedMethod)
        : 'تم حفظ الطلب واختيار طريقة الدفع، لكن تعذر إرسال إشعار الإدارة. اضغط «إكمال الطلب» مرة أخرى للمحاولة.');
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
            <div className={styles.paymentStep}><span>إكمال الطلب</span><hr /><i>2</i></div>
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
            <div className={styles.paymentStep}><span>إكمال الطلب</span><hr /><i>2</i></div>
            <h1 className={styles.paymentEmptyTitle}>أكمل بيانات الطلب أولًا</h1>
            <p className={styles.paymentEmptyText}>نحتاج بيانات التوصيل ومحتويات السلة قبل الانتقال إلى اختيار طريقة الدفع.</p>
            <Link href="/checkout/store" className={styles.paymentSubmit}>العودة لبيانات التوصيل ←</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.checkoutShell} ${styles.paymentPageShell} payment-design-page`}>
      <div className={styles.paymentTopBand}>
        <section className={styles.paymentCard} aria-label="اختيار طريقة الدفع وإكمال الطلب">
          <div className={styles.paymentStep}>
            <span>اختيار طريقة الدفع</span>
            <hr />
            <i>2</i>
          </div>

          <div className="payment-customer-summary">
            <div>
              <small>رقم الطلب</small>
              <strong>{draft.orderNumber || 'طلب جديد'}</strong>
            </div>
            <div>
              <small>اسم العميل</small>
              <strong>{draft.fullName}</strong>
            </div>
          </div>

          <div className={styles.paymentMethods} role="group" aria-label="اختيار طريقة الدفع">
            <button
              type="button"
              className={paymentMethod === 'mada' ? `${styles.paymentMethod} ${styles.paymentMethodSelected}` : styles.paymentMethod}
              aria-label="الدفع بمدى"
              aria-pressed={paymentMethod === 'mada'}
              disabled={paymentSubmitting || paymentSubmitted}
              onClick={() => { setPaymentMethod('mada'); setPaymentMessage(''); }}
            >
              <span className={styles.madaLogo}>مدى<br />mada<span className={styles.madaLogoUnderline} /></span>
            </button>
            <button
              type="button"
              className={paymentMethod === 'visa' ? `${styles.paymentMethod} ${styles.paymentMethodSelected}` : styles.paymentMethod}
              aria-label="الدفع بفيزا"
              aria-pressed={paymentMethod === 'visa'}
              disabled={paymentSubmitting || paymentSubmitted}
              onClick={() => { setPaymentMethod('visa'); setPaymentMessage(''); }}
            >
              <span className={styles.visaLogo}><i>VISA</i><b className={styles.visaCircleRed} /><b className={styles.visaCircleYellow} /></span>
            </button>
          </div>

          <div className={styles.paymentAmount}>إجمالي الطلب: {formatPrice(total)}</div>
          <p className={styles.paymentInstruction}>
            اختر طريقة الدفع، ثم اضغط «إكمال الطلب» لإرسال بيانات الطلب وطريقة الدفع معًا إلى الإدارة.
          </p>

          {paymentMessage ? (
            <div
              className={paymentSubmitted
                ? `${styles.paymentInlineMessage} ${styles.paymentInlineMessageSuccess}`
                : styles.paymentInlineMessage}
              role={paymentSubmitted ? 'status' : 'alert'}
            >
              {paymentSubmitted ? <span aria-hidden="true">✓</span> : null}
              {paymentMessage}
            </div>
          ) : null}

          <button
            type="button"
            className={styles.paymentSubmit}
            onClick={handleCompleteOrder}
            disabled={paymentSubmitting || paymentSubmitted}
          >
            {paymentSubmitting ? 'جارٍ إرسال الطلب...' : paymentSubmitted ? 'تم إرسال الطلب' : 'إكمال الطلب'}
            <span aria-hidden="true">←</span>
          </button>
        </section>
      </div>
    </main>
  );
}
