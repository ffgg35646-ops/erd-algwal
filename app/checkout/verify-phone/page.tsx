'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import styles from './verify-phone.module.css';

const DRAFT_KEY = 'erd-algwal-checkout-draft-v1';
const EMPTY_CODE = ['', '', '', ''];

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^0-9]/g, '');
}

function maskPhone(value: string) {
  const phone = normalizeDigits(value);
  if (phone.length !== 10) return phone;
  return `+966 ${phone.slice(1, 2)}** *** ${phone.slice(-2)}`;
}

export default function VerifyPhonePage() {
  const router = useRouter();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [phone, setPhone] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      const draft = raw ? JSON.parse(raw) as { phone?: unknown; stage?: unknown } : null;
      const savedPhone = typeof draft?.phone === 'string' ? normalizeDigits(draft.phone) : '';
      if (draft?.stage === 'phone-verification' && savedPhone.length === 10) {
        setPhone(savedPhone);
        setDraftReady(true);
      }
    } catch {
      // An unavailable or invalid browser draft must not bypass phone verification.
    }
  }, []);

  function setDigit(index: number, value: string) {
    const cleaned = normalizeDigits(value);
    const next = [...digits];
    if (cleaned.length > 1) {
      for (let offset = 0; offset < cleaned.length && index + offset < 4; offset += 1) {
        next[index + offset] = cleaned[offset];
      }
      setDigits(next);
      const focusIndex = Math.min(index + cleaned.length, 3);
      inputRefs.current[focusIndex]?.focus();
      setError('');
      return;
    }

    next[index] = cleaned.slice(-1);
    setDigits(next);
    setError('');
    if (cleaned && index < 3) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    } else if (event.key === 'ArrowRight' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = normalizeDigits(event.clipboardData.getData('text')).slice(0, 4);
    if (!pasted) return;
    event.preventDefault();
    setDigits([...pasted].concat(EMPTY_CODE).slice(0, 4));
    inputRefs.current[Math.min(pasted.length, 3)]?.focus();
    setError('');
  }

  function handleVerify() {
    if (digits.some((digit) => !digit)) {
      setError('من فضلك أدخل الكود كاملاً');
      return;
    }
    setError('لم يتم ربط إرسال رمز التحقق والتحقق من صحته بعد. لن يتم إنشاء الطلب أو اعتماده قبل اكتمال التحقق الفعلي.');
  }

  function handleResend() {
    setError('إعادة إرسال الكود ستُفعّل بعد تحديد وسيلة إرسال رمز التحقق.');
  }

  if (!draftReady) {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="verify-title">
          <div className={styles.icon} aria-hidden="true">
            <PhoneIcon />
          </div>
          <h1 id="verify-title">تأكيد رقم الهاتف</h1>
          <p className={styles.sub}>لا توجد بيانات طلب جاهزة لتأكيد رقم الهاتف.</p>
          <Link href="/checkout/store" className={styles.backLink}>العودة لإدخال بيانات الطلب</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="verify-title">
        <div className={styles.icon} aria-hidden="true">
          <PhoneIcon />
        </div>

        <h1 id="verify-title">تأكيد رقم الهاتف</h1>
        <p className={styles.sub}>سيتم إرسال كود التحقق إلى الرقم التالي بعد ربط وسيلة الإرسال:</p>
        <p className={styles.sub}><span className={styles.phone}>{maskPhone(phone)}</span></p>

        <div className={styles.inputs} dir="ltr" onPaste={handlePaste} aria-label="رمز التحقق المكوّن من أربعة أرقام">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => { inputRefs.current[index] = element; }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              aria-label={`رقم ${index + 1} من رمز التحقق`}
            />
          ))}
        </div>

        <div className={styles.error} role="status" aria-live="polite">{error}</div>

        <button
          type="button"
          className={styles.verifyButton}
          onClick={handleVerify}
          disabled={digits.some((digit) => !digit)}
        >
          تأكيد
        </button>

        <div className={styles.timerRow}>
          <span className={styles.timer}>سيظهر عداد إعادة الإرسال بعد ربط خدمة إرسال الكود</span>
          <button type="button" className={styles.resendButton} onClick={handleResend} disabled>
            إعادة إرسال الكود
          </button>
        </div>

        <p className={styles.notice}>لم يتم اعتماد الطلب أو إرساله للإدارة بعد. سيكتمل ذلك فقط بعد التحقق من رقم الهاتف.</p>
        <Link href="/checkout/store" className={styles.backLink}>العودة لتعديل بيانات الطلب</Link>
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
