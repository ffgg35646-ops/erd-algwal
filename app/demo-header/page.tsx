'use client';

import { useState } from 'react';

export default function DemoHeaderPage() {
  const [demoDigits, setDemoDigits] = useState('');
  const variant = demoDigits === '4909' ? 'nova' : demoDigits === '5297' ? 'rivan' : 'orbit';

  return (
    <main className="demo-shell" dir="rtl">
      <style jsx>{`
        * { box-sizing: border-box; }
        .demo-shell { min-height: 100vh; background: #f4f7fb; padding: 28px 16px; color: #183153; font-family: Arial, Tahoma, sans-serif; }
        .demo-wrap { width: 100%; max-width: 760px; margin: 0 auto; }
        .demo-note { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 14px; padding: 6px 10px; border-radius: 999px; background: #e8f1ff; color: #234c83; font-size: 12px; font-weight: 700; }
        .demo-dot { width: 7px; height: 7px; border-radius: 50%; background: #4385d8; }
        .header-bar { width: 100%; min-height: 76px; padding: 14px 24px; display: flex; direction: ltr; align-items: center; justify-content: space-between; gap: 16px; background: #fff; border: 1px solid #e5eaf1; border-radius: 12px; box-shadow: 0 5px 18px rgba(24,49,83,.06); }
        .visaa-logo { color: #123d9b; font-family: Arial,Helvetica,sans-serif; font-size: 30px; line-height: 1; font-weight: 900; font-style: italic; letter-spacing: -1.5px; white-space: nowrap; }
        .visaa-logo span { color: #16a6c3; }
        .demo-brand { display: flex; align-items: center; gap: 9px; color: #19458c; font-family: Arial,Helvetica,sans-serif; font-size: 23px; font-weight: 800; letter-spacing: -.7px; white-space: nowrap; }
        .demo-brand.orbit { color: #7751a8; }
        .brand-mark { width: 29px; height: 29px; display: block; flex: none; }
        .rivan-layout { display: flex; align-items: center; justify-content: space-between; width: 100%; direction: ltr; gap: 12px; }
        .rivan-name { display: flex; align-items: center; gap: 10px; direction: rtl; color: #58637b; }
        .rivan-symbol { width: 44px; height: 44px; flex: none; }
        .rivan-copy { display: flex; flex-direction: column; gap: 2px; text-align: right; }
        .rivan-ar { font-family: Tahoma,Arial,sans-serif; font-size: 19px; line-height: 1.15; font-weight: 700; }
        .rivan-en { font-family: Arial,Helvetica,sans-serif; font-size: 17px; line-height: 1.1; font-weight: 700; letter-spacing: .2px; }
        .verify-mark { width: 42px; height: 28px; position: relative; flex: none; }
        .verify-circle { position: absolute; top: 1px; width: 27px; height: 27px; border-radius: 50%; }
        .verify-circle-a { left: 0; background: #67549d; }
        .verify-circle-b { left: 15px; background: #17a68e; opacity: .9; }
        .verify-divider { height: 30px; width: 1px; background: #b9bec8; flex: none; }
        .verify-copy { display: flex; align-items: center; gap: 10px; direction: ltr; color: #30323a; font-size: 17px; font-weight: 500; white-space: nowrap; }
        .demo-controls { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 260px; margin: 26px auto 0; }
        .demo-label { color: #334155; font-size: 13px; font-weight: 700; }
        .demo-input { width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #183153; font-size: 19px; letter-spacing: 4px; text-align: center; outline: none; }
        .demo-input:focus { border-color: #4385d8; box-shadow: 0 0 0 3px rgba(67,133,216,.13); }
        .demo-state { min-height: 22px; color: #64748b; font-size: 12px; text-align: center; }
        .demo-caption { margin: 18px 2px 0; color: #64748b; font-size: 13px; line-height: 1.8; text-align: right; }
        @media (max-width: 480px) {
          .demo-shell { padding: 20px 12px; }
          .header-bar { min-height: 64px; padding: 11px 12px; gap: 8px; border-radius: 10px; }
          .visaa-logo { font-size: 24px; }
          .demo-brand { gap: 7px; font-size: 19px; }
          .brand-mark { width: 24px; height: 24px; }
          .rivan-symbol { width: 34px; height: 34px; }
          .rivan-name { gap: 7px; }
          .rivan-ar { font-size: 15px; }
          .rivan-en { font-size: 13px; }
          .verify-copy { gap: 6px; font-size: 13px; }
          .verify-mark { width: 34px; height: 24px; }
          .verify-circle { width: 22px; height: 22px; }
          .verify-circle-b { left: 12px; }
          .verify-divider { height: 24px; }
        }
        @media (max-width: 350px) {
          .header-bar { padding-inline: 8px; }
          .rivan-symbol { width: 29px; height: 29px; }
          .rivan-ar { font-size: 13px; }
          .rivan-en { font-size: 11px; }
          .verify-copy { gap: 4px; font-size: 11px; }
          .verify-mark { width: 29px; }
          .verify-circle { width: 19px; height: 19px; }
          .verify-circle-b { left: 10px; }
        }
      `}</style>

      <section className="demo-wrap" aria-label="معاينة شريط تجريبي">
        <div className="demo-note"><span className="demo-dot" aria-hidden="true" />واجهة تجريبية مستقلة — لا تجمع أو ترسل بيانات</div>

        <header className="header-bar" aria-live="polite">
          {variant === 'rivan' ? (
            <div className="rivan-layout">
              <div className="verify-copy" aria-label="IDENTITY VERIFY تجريبي">
                <span className="verify-mark" aria-hidden="true">
                  <i className="verify-circle verify-circle-a" />
                  <i className="verify-circle verify-circle-b" />
                </span>
                <span className="verify-divider" />
                <span>IDENTITY VERIFY</span>
              </div>
              <div className="rivan-name" aria-label="ريفان RIVAN علامة خيالية">
                <svg className="rivan-symbol" viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M7 35 7 82 34 82 34 58 51 35Z" fill="#62518d" />
                  <path d="M50 8 33 25 33 48 51 30 94 30 94 8Z" fill="#16a58d" />
                  <path d="M7 35 34 35 34 58Z" fill="#16a58d" />
                </svg>
                <span className="rivan-copy"><span className="rivan-ar">ريفان</span><span className="rivan-en">RIVAN</span></span>
              </div>
            </div>
          ) : (
            <>
              <div className="visaa-logo" aria-label="علامة تجريبية">VISAA<span>+</span></div>
              <div className={`demo-brand ${variant}`}>
                {variant === 'nova' ? (
                  <svg className="brand-mark" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                    <circle cx="50" cy="50" r="37" stroke="#19458c" strokeWidth="10" />
                    <path d="M29 51 44 66 73 35" stroke="#16a6c3" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="brand-mark" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                    <ellipse cx="50" cy="50" rx="39" ry="17" stroke="#7751a8" strokeWidth="9" transform="rotate(-35 50 50)" />
                    <ellipse cx="50" cy="50" rx="39" ry="17" stroke="#b49ad6" strokeWidth="9" transform="rotate(35 50 50)" />
                    <circle cx="50" cy="50" r="8" fill="#7751a8" />
                  </svg>
                )}
                <span>{variant === 'nova' ? 'NOVA' : 'ORBIT'}</span>
              </div>
            </>
          )}
        </header>

        <div className="demo-controls">
          <label className="demo-label" htmlFor="demo-digits">أدخل رمزًا تجريبيًا من 4 أرقام</label>
          <input id="demo-digits" className="demo-input" type="text" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0000" value={demoDigits} onChange={(event) => setDemoDigits(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))} aria-describedby="demo-state" />
          <div className="demo-state" id="demo-state" aria-live="polite">
            {demoDigits.length === 4 ? `المظهر المعروض: ${variant === 'rivan' ? 'RIVAN التجريبي' : variant.toUpperCase()}` : 'أدخل أربعة أرقام لمعاينة تبديل الهوية'}
          </div>
        </div>

        <p className="demo-caption">في هذه المعاينة فقط: 4909 يعرض NOVA، و5297 يعرض RIVAN بهوية خيالية، وباقي الأرقام تعرض ORBIT. لا توجد حقول دفع أو تحقق أو إرسال بيانات.</p>
      </section>
    </main>
  );
}
