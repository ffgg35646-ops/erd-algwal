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

type VerifyAmountResponse = {
  ok?: boolean;
  total?: number;
  currency?: string;
  orderNumber?: string;
  error?: string;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const EXPIRY_YEARS = Array.from({ length: 15 }, (_, index) => String(new Date().getFullYear() + index));

function confirmationMessage(method: 'mada' | 'visa') {
  return 'تم إرسال بيانات الطلب واختيار ' + (method === 'mada' ? 'مدى' : 'Visa') + ' إلى الإدارة.';
}

export default function CheckoutPaymentPage() {
  const { cart, hydrated, catalogProducts: products } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'visa'>('visa');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [totalVerified, setTotalVerified] = useState(false);
  const [totalError, setTotalError] = useState('');
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const cardDetailsRef = useRef<HTMLFormElement>(null);

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

  useEffect(() => {
    if (!draftLoaded) return;
    if (!draft?.orderId || !draft.submissionId) {
      setTotalError('بيانات الطلب غير مكتملة. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      setTotalVerified(true);
      return;
    }

    let cancelled = false;
    async function verifySavedOrderTotal() {
      setTotalVerified(false);
      setTotalError('');
      setServerTotal(null);
      try {
        const reviewToken = window.localStorage.getItem('erd-algwal-review-token') || '';
        if (!reviewToken) throw new Error('تعذر التحقق من ملكية الطلب. ارجع إلى بيانات التوصيل وحاول مرة أخرى.');

        const response = await fetch('/api/orders/payment-method', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'verify-total',
            orderId: draft.orderId,
            submissionId: draft.submissionId,
            reviewToken
          })
        });
        const result = await response.json() as VerifyAmountResponse;
        if (!response.ok || !result.ok || typeof result.total !== 'number' || !Number.isFinite(result.total) || result.total <= 0) {
          throw new Error(result.error || 'تعذر التحقق من إجمالي الطلب المسجل.');
        }
        if (cancelled) return;

        setServerTotal(result.total);
        setDraft((current) => current ? {
          ...current,
          total: result.total,
          currency: result.currency || current.currency || 'SAR',
          orderNumber: result.orderNumber || current.orderNumber
        } : current);
      } catch (error) {
        if (!cancelled) {
          setServerTotal(null);
          setTotalError(error instanceof Error ? error.message : 'تعذر التحقق من إجمالي الطلب حاليًا.');
        }
      } finally {
        if (!cancelled) setTotalVerified(true);
      }
    }

    void verifySavedOrderTotal();
    return () => { cancelled = true; };
  }, [draftLoaded, draft?.orderId, draft?.submissionId, verificationAttempt]);

  const lines = useMemo(() => Object.entries(cart).map(([cartKey, quantity]) => {
    const { productId } = parseCartItemKey(cartKey);
    return { product: products.find((item) => item.id === productId), quantity };
  }).filter((line) => Boolean(line.product)), [cart, products]);

  async function handleCompleteOrder() {
    if (paymentSubmitting || paymentSubmitted) return;
    if (serverTotal === null || !Number.isFinite(serverTotal) || serverTotal <= 0) {
      setPaymentMessage('لا يمكن إكمال الطلب قبل التحقق من المبلغ المستحق.');
      return;
    }
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

    let cardholderName = '';
    let cardLast4 = '';
    let expiryMonth = '';
    let expiryYear = '';
    if (paymentMethod === 'visa') {
      const form = cardDetailsRef.current;
      if (!form?.checkValidity()) {
        form?.reportValidity();
        setPaymentMessage('أكمل اسم حامل البطاقة وآخر أربعة أرقام وتاريخ الانتهاء.');
        return;
      }
      const formData = new FormData(form);
      cardholderName = String(formData.get('cardholderName') || '').trim().slice(0, 100);
      cardLast4 = String(formData.get('cardLast4') || '').replace(/\D/g, '');
      expiryMonth = String(formData.get('expiryMonth') || '');
      expiryYear = String(formData.get('expiryYear') || '');
      if (!cardholderName || !/^[0-9]{4}$/.test(cardLast4)) {
        setPaymentMessage('تحقق من اسم حامل البطاقة وآخر أربعة أرقام.');
        return;
      }
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
          ...(paymentMethod === 'visa'
            ? { cardholderName, cardLast4, expiryMonth, expiryYear }
            : {})
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
        total: serverTotal,
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

  if (!hydrated || !draftLoaded || (draft?.orderId && !totalVerified)) {
    return (
      <main className={styles.checkoutShell + ' ' + styles.paymentPageShell + ' payment-design-page'}>
        <div className={styles.paymentTopBand}>
          <div className={styles.paymentCard}>
            <div className={styles.paymentStep}><i>2</i><span>طريقة الدفع</span><hr /></div>
            <p>جاري التحقق من إجمالي الطلب...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!draft || !draft.fullName || !draft.acceptedPolicies || !lines.length) {
    return (
      <main className={styles.checkoutShell + ' ' + styles.paymentPageShell + ' payment-design-page'}>
        <div className={styles.paymentTopBand}>
          <section className={styles.paymentCard}>
            <div className={styles.paymentStep}><i>2</i><span>طريقة الدفع</span><hr /></div>
            <h1 className={styles.paymentEmptyTitle}>أكمل بيانات الطلب أولًا</h1>
            <p className={styles.paymentEmptyText}>نحتاج بيانات التوصيل ومحتويات السلة قبل الانتقال إلى اختيار طريقة الدفع.</p>
            <Link href="/checkout/store" className={styles.paymentSubmit}>العودة لبيانات التوصيل ←</Link>
          </section>
        </div>
      </main>
    );
  }

  if (serverTotal === null) {
    return (
      <main className={styles.checkoutShell + ' ' + styles.paymentPageShell + ' payment-design-page'}>
        <div className={styles.paymentTopBand}>
          <section className={styles.paymentCard}>
            <div className={styles.paymentStep}><i>2</i><span>طريقة الدفع</span><hr /></div>
            <h1 className={styles.paymentEmptyTitle}>تعذر التحقق من المبلغ المستحق</h1>
            <p className={styles.paymentEmptyText}>{totalError || 'لم نتمكن من قراءة إجمالي الطلب المسجل.'}</p>
            <button type="button" className={styles.paymentSubmit} onClick={() => setVerificationAttempt((current) => current + 1)}>إعادة التحقق من المبلغ</button>
            <Link href="/checkout/store" className={styles.paymentBackLink}>العودة إلى بيانات الطلب</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.checkoutShell + ' ' + styles.paymentPageShell + ' payment-design-page'}>
      <div className={styles.paymentTopBand}>
        <section className={styles.paymentCard} aria-label="اختيار طريقة الدفع وإكمال الطلب">
          <div className={styles.paymentStep}>
            <i>2</i>
            <span>طريقة الدفع</span>
            <hr />
          </div>

          <div className={styles.paymentMethods} role="group" aria-label="اختيار طريقة الدفع">
            <button
              type="button"
              className={paymentMethod === 'visa' ? styles.paymentMethod + ' ' + styles.paymentMethodSelected : styles.paymentMethod}
              aria-label="Visa / Mastercard"
              aria-pressed={paymentMethod === 'visa'}
              disabled={paymentSubmitting || paymentSubmitted}
              onClick={() => { setPaymentMethod('visa'); setPaymentMessage(''); }}
            >
              <span className={styles.visaLogo}><i>VISA</i><b className={styles.visaCircleRed} /><b className={styles.visaCircleYellow} /></span>
            </button>
            <button
              type="button"
              className={paymentMethod === 'mada' ? styles.paymentMethod + ' ' + styles.paymentMethodSelected : styles.paymentMethod}
              aria-label="mada"
              aria-pressed={paymentMethod === 'mada'}
              disabled={paymentSubmitting || paymentSubmitted}
              onClick={() => { setPaymentMethod('mada'); setPaymentMessage(''); }}
            >
              <span className={styles.madaLogo}><span className={styles.madaLogoUnderline} />مدى <small>mada</small></span>
            </button>
          </div>

          <div className={styles.paymentAmount}>
            المبلغ المستحق : <strong>{formatPrice(serverTotal)}</strong>
          </div>

          {paymentMethod === 'visa' ? (
            <form ref={cardDetailsRef} className={styles.paymentFields} aria-label="بيانات تعريف بطاقة Visa">
              <input
                className={styles.paymentInput}
                name="cardholderName"
                type="text"
                placeholder="اسم حامل البطاقة"
                aria-label="اسم حامل البطاقة"
                autoComplete="cc-name"
                maxLength={100}
                required
                disabled={paymentSubmitting || paymentSubmitted}
              />
              <input
                className={styles.paymentInput}
                name="cardLast4"
                type="text"
                placeholder="آخر 4 أرقام من البطاقة"
                aria-label="آخر أربعة أرقام من البطاقة"
                inputMode="numeric"
                pattern="[0-9]{4}"
                minLength={4}
                maxLength={4}
                autoComplete="off"
                required
                disabled={paymentSubmitting || paymentSubmitted}
              />
              <div className={styles.paymentExpiryRow}>
                <label className={styles.paymentExpiryBox}>
                  <span className={styles.visuallyHidden}>شهر الانتهاء</span>
                  <select name="expiryMonth" aria-label="شهر الانتهاء" defaultValue="" required disabled={paymentSubmitting || paymentSubmitted}>
                    <option value="" disabled>الشهر</option>
                    {MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                  </select>
                </label>
                <label className={styles.paymentExpiryBox}>
                  <span className={styles.visuallyHidden}>سنة الانتهاء</span>
                  <select name="expiryYear" aria-label="سنة الانتهاء" defaultValue="" required disabled={paymentSubmitting || paymentSubmitted}>
                    <option value="" disabled>السنة</option>
                    {EXPIRY_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
              </div>
            </form>
          ) : null}

          <div className={styles.paymentSafe}>
            🛡️ لا نطلب أو نخزن رقم البطاقة الكامل أو رمز الأمان (CVC).
          </div>
          <p className={styles.paymentInstruction}>
            هذه الصفحة تسجل طريقة الدفع وبيانات تعريف محدودة للبطاقة وترسل الطلب إلى الإدارة؛ ولا تنفذ خصمًا ماليًا.
          </p>

          {paymentMessage ? (
            <div
              className={paymentSubmitted
                ? styles.paymentInlineMessage + ' ' + styles.paymentInlineMessageSuccess
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
            disabled={paymentSubmitting || paymentSubmitted || serverTotal === null}
          >
            {paymentSubmitting ? 'جارٍ إرسال الطلب...' : paymentSubmitted ? 'تم إرسال الطلب' : 'إكمال الطلب'}
            <span aria-hidden="true">←</span>
          </button>
        </section>
      </div>
    </main>
  );
}
