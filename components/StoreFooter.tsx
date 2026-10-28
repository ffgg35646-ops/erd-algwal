'use client';

import { useEffect, useMemo, useState } from 'react';

type StorePage = {
  key: string;
  title: string;
  group: 'policies' | 'customer-service';
  content: string;
  updatedAt: string | null;
};

const PAGE_LINKS = {
  policies: [
    { key: 'privacy', title: 'سياسة الخصوصية' },
    { key: 'terms', title: 'الشروط والأحكام' },
    { key: 'returns', title: 'الاستبدال والاسترجاع' }
  ],
  'customer-service': [
    { key: 'shipping', title: 'الشحن والتوصيل' },
    { key: 'payment-methods', title: 'طرق الدفع' },
    { key: 'ordering', title: 'طلب الدفع والشراء' },
    { key: 'faq', title: 'الأسئلة الشائعة' }
  ]
} as const;

const FALLBACK_TEXT: Record<string, string> = {
  privacy: 'لم تتم إضافة نص سياسة الخصوصية بعد. للاستفسار، يرجى التواصل مع خدمة العملاء.',
  terms: 'لم تتم إضافة نص الشروط والأحكام بعد. يرجى مراجعة النص المحدث قبل استخدام خدمات المتجر.',
  returns: 'لم تتم إضافة نص سياسة الاستبدال والاسترجاع بعد. يرجى التواصل مع خدمة العملاء لمعرفة الشروط المعتمدة.',
  shipping: 'لم تتم إضافة تفاصيل الشحن والتوصيل بعد. تواصل مع خدمة العملاء لتأكيد تفاصيل طلبك.',
  'payment-methods': 'لم تتم إضافة طرق الدفع بعد. تواصل مع خدمة العملاء لمعرفة الطرق المتاحة حاليًا.',
  ordering: 'لم تتم إضافة تعليمات الطلب والشراء بعد. يمكنك اختيار المنتجات وإضافتها إلى السلة ثم متابعة خطوات إتمام الطلب.',
  faq: 'لم تتم إضافة الأسئلة الشائعة بعد. أرسل استفسارك إلى خدمة العملاء وسنساعدك.'
};

export default function StoreFooter() {
  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [barcodeImageUrl, setBarcodeImageUrl] = useState('');

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const [pagesResponse, settingsResponse] = await Promise.all([
          fetch('/api/store-content', { cache: 'no-store' }),
          fetch('/api/store-settings', { cache: 'no-store' })
        ]);
        if (pagesResponse.ok) {
          const data = await pagesResponse.json() as { pages?: StorePage[] };
          if (alive && Array.isArray(data.pages)) setPages(data.pages);
        }
        if (settingsResponse.ok) {
          const data = await settingsResponse.json() as { whatsappNumber?: string; vatNumber?: string; barcodeImageUrl?: string };
          if (alive && typeof data.whatsappNumber === 'string') setWhatsappNumber(data.whatsappNumber);
          if (alive && typeof data.vatNumber === 'string') setVatNumber(data.vatNumber);
          if (alive && typeof data.barcodeImageUrl === 'string') setBarcodeImageUrl(data.barcodeImageUrl);
        }
      } catch {
        // Keep the fallback links working if settings cannot be loaded.
      }
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    const handleFocus = () => { void refresh(); };
    window.addEventListener('focus', handleFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!selectedKey) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedKey(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedKey]);

  const selectedPage = useMemo(() => {
    if (!selectedKey) return null;
    return pages.find((page) => page.key === selectedKey) || {
      key: selectedKey,
      title: PAGE_LINKS.policies.find((page) => page.key === selectedKey)?.title
        || PAGE_LINKS['customer-service'].find((page) => page.key === selectedKey)?.title
        || '',
      group: 'policies' as const,
      content: FALLBACK_TEXT[selectedKey] || '',
      updatedAt: null
    };
  }, [pages, selectedKey]);

  return (
    <>
      <footer className="store-site-footer">
        <div className="store-footer-inner container">
          <div className="store-footer-brand">
            <span className="stream-footer-mark">أ</span>
            <strong>أرض الجوال</strong>
            <p className="store-footer-vat">الرقم الضريبي: {vatNumber ? <bdi dir="ltr">{vatNumber}</bdi> : <span>مثال مؤقت: 000000000000000 – غير صالح للاستخدام الضريبي</span>}</p>
            <p>متجر متخصص في الجوالات وملحقاتها، مع أقسام تساعدك على الوصول إلى المنتجات بسهولة.</p>
            <small>© {new Date().getFullYear()} أرض الجوال. جميع الحقوق محفوظة.</small>
          </div>

          <nav className="store-footer-column" aria-label="خدمات العملاء">
            <h2>خدمات العملاء</h2>
            {PAGE_LINKS['customer-service'].map((page) => (
              <button type="button" key={page.key} onClick={() => setSelectedKey(page.key)}>{page.title}</button>
            ))}
          </nav>

          <nav className="store-footer-column" aria-label="السياسات">
            <h2>السياسات</h2>
            {PAGE_LINKS.policies.map((page) => (
              <button type="button" key={page.key} onClick={() => setSelectedKey(page.key)}>{page.title}</button>
            ))}
          </nav>

          <div className="store-footer-column store-footer-contact">
            <h2>تواصل معنا</h2>
            <p>نسعد بخدمتك ومتابعة استفساراتك.</p>
            {whatsappNumber ? (
              <a href={'https://wa.me/' + whatsappNumber} target="_blank" rel="noreferrer"><span className="footer-whatsapp-icon" aria-hidden="true"><svg className="footer-whatsapp-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.7 11.7 0 0 0 2.1 17.6L.5 23.5l6.1-1.6A11.7 11.7 0 0 0 23.5 11.8c0-3.1-1.2-6-3-8.3ZM11.8 21a9.2 9.2 0 0 1-4.7-1.3l-.3-.2-3.6.9.9-3.5-.2-.4a9.2 9.2 0 1 1 7.9 4.5Zm5.1-6.9c-.3-.1-1.6-.8-1.9-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.9 1.1-.2.2-.4.2-.7.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.3c0 1.4 1 2.7 1.2 2.9.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.8-1.3.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.6-.4Z"/></svg></span> واتساب المتجر</a>
            ) : (
              <span className="store-footer-muted"><span className="footer-whatsapp-icon" aria-hidden="true"><svg className="footer-whatsapp-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.7 11.7 0 0 0 2.1 17.6L.5 23.5l6.1-1.6A11.7 11.7 0 0 0 23.5 11.8c0-3.1-1.2-6-3-8.3ZM11.8 21a9.2 9.2 0 0 1-4.7-1.3l-.3-.2-3.6.9.9-3.5-.2-.4a9.2 9.2 0 1 1 7.9 4.5Zm5.1-6.9c-.3-.1-1.6-.8-1.9-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.9 1.1-.2.2-.4.2-.7.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.3c0 1.4 1 2.7 1.2 2.9.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.8-1.3.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.6-.4Z"/></svg></span> مثال مؤقت: 966500000000 – غير مفعّل</span>
            )}
          </div>

          <div className="store-footer-column store-footer-barcode">
            <h2>الباركود</h2>
            {barcodeImageUrl ? (
              <img
                src={barcodeImageUrl}
                alt="باركود أرض الجوال"
                width={150}
                height={150}
                loading="lazy"
              />
            ) : (
              <div className="footer-demo-barcode" aria-label="نموذج باركود توضيحي غير صالح للمسح">
                <svg viewBox="0 0 120 70" aria-hidden="true"><rect width="120" height="70" fill="#fff"/>{Array.from({length: 26}, (_, i) => <rect key={i} x={4+i*4.3} y="7" width={i%3===0?3:1.8} height={i%4===0?51:43} fill="#242424"/>)}</svg>
                <small>نموذج مؤقت – يُستبدل من الإدارة</small>
              </div>
            )}
          </div>
        </div>

        <div className="store-footer-trust container" aria-label="مميزات المتجر">
          <div className="store-footer-trust-item"><span aria-hidden="true">✓</span><strong>دفع آمن</strong></div>
          <div className="store-footer-trust-item"><span aria-hidden="true">◇</span><strong>متجر موثوق</strong></div>
          <div className="store-footer-trust-item"><span aria-hidden="true">↗</span><strong>شحن سريع</strong></div>
        </div>
      </footer>

      {selectedPage ? (
        <div className="store-page-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedKey(null);
        }}>
          <section className="store-page-modal" role="dialog" aria-modal="true" aria-labelledby="store-page-modal-title">
            <div className="store-page-modal-head">
              <div>
                <span>أرض الجوال</span>
                <h2 id="store-page-modal-title">{selectedPage.title}</h2>
              </div>
              <button type="button" className="store-page-modal-close" aria-label="إغلاق" onClick={() => setSelectedKey(null)}>×</button>
            </div>
            <div className="store-page-modal-content">{selectedPage.content || FALLBACK_TEXT[selectedPage.key] || ''}</div>
            {selectedPage.updatedAt ? <time dateTime={selectedPage.updatedAt}>آخر تحديث: {new Date(selectedPage.updatedAt).toLocaleDateString('ar-SA')}</time> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
