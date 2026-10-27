'use client';

import { useEffect, useState } from 'react';

type StoreSettings = { whatsappNumber?: string };

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
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
        if (active) {
          const nextPhone = normalizePhone(data.whatsappNumber || '');
          setPhone(nextPhone);
          if (nextPhone) setUnavailable(false);
        }
      } catch {
        // The button remains in place if settings cannot be refreshed.
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

  const href = phone ? 'https://wa.me/' + phone : '';

  return (
    <div className="whatsapp-support-wrap" dir="rtl">
      {unavailable ? <div className="whatsapp-support-note" role="status">رقم دعم واتساب لم يحدده المتجر بعد.</div> : null}
      {href ? (
        <a className="whatsapp-support-button" href={href} target="_blank" rel="noopener noreferrer" aria-label="تواصل مع دعم أرض الجوال على واتساب" title="تواصل معنا واتساب">
          <WhatsAppIcon />
        </a>
      ) : (
        <button type="button" className="whatsapp-support-button" onClick={() => setUnavailable(true)} aria-label="تواصل مع دعم أرض الجوال على واتساب" title="تواصل معنا واتساب">
          <WhatsAppIcon />
        </button>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3.2A12.5 12.5 0 0 0 5.3 22.2L3.6 28.4l6.4-1.7A12.5 12.5 0 1 0 16 3.2Z" />
      <path d="M11.1 9.3c-.3-.6-.6-.6-.9-.6h-.7c-.3 0-.7.1-1 .5-.4.4-1.3 1.2-1.3 3s1.3 3.5 1.4 3.7c.2.2 2.5 4 6.2 5.4 3 .1 3.6.1 4.8-.6.9-.4 1.6-1.3 1.7-2.1.2-.8.2-1.5.1-1.7-.1-.1-.4-.3-.9-.5-.4-.2-2.4-1.2-2.8-1.3-.4-.2-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.3-.4.3-.8.1-.4-.2-1.7-.6-3.2-1.9-1.2-1-1.9-2.3-2.1-2.7-.2-.4 0-.6.2-.8.2-.2.4-.4.6-.7.2-.2.3-.4.4-.6.1-.3 0-.5 0-.7-.1-.2-.9-2.2-1.2-2.8Z" />
    </svg>
  );
}
