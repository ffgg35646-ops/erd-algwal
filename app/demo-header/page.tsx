'use client';

import { useState } from 'react';

export default function DemoHeaderPage() {
  const [demoDigits, setDemoDigits] = useState('');
  const isNova = demoDigits === '4909';
  const brandName = isNova ? 'NOVA' : 'ORBIT';

  return (
    <main className="demo-shell" dir="rtl">
      <style jsx>{`
        * { box-sizing: border-box; }
        .demo-shell {
          min-height: 100vh;
          background: #f4f7fb;
          padding: 28px 16px;
          color: #183153;
          font-family: Arial, Tahoma, sans-serif;
        }
        .demo-wrap {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
        }
        .demo-note {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin: 0 0 14px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #e8f1ff;
          color: #234c83;
          font-size: 12px;
          font-weight: 700;
        }
        .demo-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4385d8;
        }
        .header-bar {
          width: 100%;
          min-height: 66px;
          padding: 14px 24px;
          display: flex;
          direction: ltr;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: #fff;
          border: 1px solid #e5eaf1;
          border-radius: 12px;
          box-shadow: 0 5px 18px rgba(24, 49, 83, .06);
        }
        .visaa-logo {
          color: #123d9b;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 30px;
          line-height: 1;
          font-weight: 900;
          font-style: italic;
          letter-spacing: -1.5px;
          white-space: nowrap;
        }
        .visaa-logo span { color: #16a6c3; }
        .demo-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #19458c;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 23px;
          font-weight: 800;
          letter-spacing: -.7px;
          white-space: nowrap;
          transition: color .18s ease;
        }
        .demo-brand.orbit { color: #7751a8; }
        .brand-mark {
          width: 29px;
          height: 29px;
          display: block;
          flex: none;
        }
        .demo-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 260px;
          margin: 26px auto 0;
        }
        .demo-label {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }
        .demo-input {
          width: 100%;
          height: 44px;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          color: #183153;
          font-size: 19px;
          letter-spacing: 4px;
          text-align: center;
          outline: none;
        }
        .demo-input:focus {
          border-color: #4385d8;
          box-shadow: 0 0 0 3px rgba(67,133,216,.13);
        }
        .demo-state {
          min-height: 22px;
          color: #64748b;
          font-size: 12px;
          text-align: center;
        }
        .demo-caption {
          margin: 18px 2px 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.8;
          text-align: right;
        }
        @media (max-width: 480px) {
          .demo-shell { padding: 20px 12px; }
          .header-bar { min-height: 58px; padding: 12px 14px; border-radius: 10px; }
          .visaa-logo { font-size: 25px; }
          .demo-brand { gap: 7px; font-size: 20px; }
          .brand-mark { width: 25px; height: 25px; }
        }
      `}</style>

      <section className="demo-wrap" aria-label="معاينة الشريط التجريبي">
        <div className="demo-note">
          <span className="demo-dot" aria-hidden="true" />
          واجهة تجريبية — لا تجمع أو ترسل بيانات
        </div>

        <header className="header-bar">
          <div className="visaa-logo" aria-label="VISAA تجريبي">
            VISAA<span>+</span>
          </div>

          <div className={`demo-brand ${isNova ? 'nova' : 'orbit'}`} aria-live="polite">
            {isNova ? (
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
            <span>{brandName}</span>
          </div>
        </header>

        <div className="demo-controls">
          <label className="demo-label" htmlFor="demo-digits">
            أدخل آخر 4 أرقام للتجربة
          </label>
          <input
            id="demo-digits"
            className="demo-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="0000"
            value={demoDigits}
            onChange={(event) => setDemoDigits(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            aria-describedby="demo-state"
          />
          <div className="demo-state" id="demo-state" aria-live="polite">
            {demoDigits.length === 4
              ? `الشعار المعروض الآن: ${brandName}`
              : 'اكتب 4 أرقام لمعاينة تبديل الشعار'}
          </div>
        </div>

        <p className="demo-caption">
          معاينة مستقلة للشريط العلوي فقط. الرقم 4909 يعرض NOVA، وباقي الأرقام تعرض ORBIT. لا توجد حقول دفع أو تحقق في هذه الصفحة.
        </p>
      </section>
    </main>
  );
}
