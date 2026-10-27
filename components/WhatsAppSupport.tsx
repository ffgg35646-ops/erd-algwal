'use client';

import { useEffect, useState } from 'react';

type StoreSettings = { whatsappNumber?: string };

function normalizePhone(value: string) {
  return value.replace(/\\D/g, '');
}

export default function WhatsAppSupport() {
  const [phone, setPhone] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/store-settings', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as StoreSettings;
        if (active) setPhone(normalizePhone(data.whatsappNumber || ''));
      } catch {
        // The support control remains available even if settings cannot be refreshed.
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const href = phone ? `https://wa.me/${phone}` : '';

  return (
    <div className="whatsapp-support-wrap" dir="rtl">
      {unavailable ? <div className="whatsapp-support-note" role="status">رقم دعم واتساب لم يحدده المتجر بعد.</div> : null}
      {href ? (
        <a
          className="whatsapp-support-button"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل مع دعم أرض الجوال على واتساب"
          title="تواصل معنا واتساب"
        >
          <WhatsAppIcon />
        </a>
      ) : (
        <button
          type="button"
          className="whatsapp-support-button"
          onClick={() => setUnavailable(true)}
          aria-label="تواصل مع دعم أرض الجوال على واتساب"
          title="تواصل معنا واتساب"
        >
          <WhatsAppIcon />
        </button>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path fill="currentColor" d="M16.03 3.2A12.7 12.7 0 0 0 5.15 22.45L3.4 28.8l6.53-1.71A12.7 12.7 0 1 0 16.03 3.2Zm0 23.1a10.4 10.4 0 0 1-5.3-1.45l-.38-.23-3.88 1.02 1.04-3.78-.25-.4a10.42 10.42 0 1 1 8.77 4.84Zm5.72-7.8c-.31-.16-1.83-.9-2.11-1-.28-.1-.49-.16-.69.16-.2.31-.79 1- .97 1.2-.18.21-.36.23-.67.08-.31-.16-1.3-.48-2.48-1.52-.92-.82-1.54-1.83-1.72-2.14-.18-.31-.02-.48.14-.63.14-.14.31-.36.46-.54.15-.18.2-.31.3-.51.1-.21.05-.39-.03-.55-.08-.15-.69-1.67-.95-2.29-.25-.6-.5-.52-.69-.53l-.59-.01c-.2 0-.54.08-.82.39-.28.31-1.07 1.05-1.07 2.57s1.1 2.98 1.26 3.18c.15.21 2.17 3.31 5.26 4.64.73.31 1.3.5 1.75.64.73.23 1.4.2 1.93.12.59-.09 1.83-.75 2.09-1.47.26-.72.26-1.33.18-1.47-.08-.13-.28-.21-.59-.36Z"/>
    </svg>
  );
}
