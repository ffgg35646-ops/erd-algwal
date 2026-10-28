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
  const [whatsappNumber, setWhatsappNumber] = useState('201090466376');
  const [vatNumber, setVatNumber] = useState('4353454564');
  const [barcodeImageUrl, setBarcodeImageUrl] = useState('');
  const [barcodeRemoved, setBarcodeRemoved] = useState(false);

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
          const data = await settingsResponse.json() as { whatsappNumber?: string; vatNumber?: string; barcodeImageUrl?: string; barcodeRemoved?: boolean };
          if (alive && typeof data.whatsappNumber === 'string') setWhatsappNumber(data.whatsappNumber);
          if (alive && typeof data.vatNumber === 'string') setVatNumber(data.vatNumber);
          if (alive && typeof data.barcodeImageUrl === 'string') setBarcodeImageUrl(data.barcodeImageUrl);
          if (alive) setBarcodeRemoved(data.barcodeRemoved === true);
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

  const whatsappDigits = whatsappNumber.replace(/\D/g, '');
  const whatsappLink = !whatsappNumber.includes('..') && /^\d{10,15}$/.test(whatsappDigits) ? 'https://wa.me/' + whatsappDigits : '';

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
            <span className="stream-footer-mark store-footer-logo" aria-label="شعار أرض الجوال"><svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><rect x="10" y="5" width="23" height="34" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2.1"/><path d="M16 10h11M18 33h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M35 5.5l2.2 5.2 5.2 2.2-5.2 2.2-2.2 5.2-2.2-5.2-5.2-2.2 5.2-2.2z" fill="currentColor" transform="translate(-1 0) scale(.9)"/></svg></span>
            <strong>أرض الجوال</strong>
            <p className="store-footer-vat">الرقم الضريبي: {vatNumber ? <bdi dir="ltr">{vatNumber}</bdi> : <span>لم يُضف رقم ضريبي</span>}</p>
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
            <h2><a className="store-footer-contact-link" href={whatsappLink} target="_blank" rel="noreferrer">تواصل معنا</a></h2>
            <p>نسعد بخدمتك ومتابعة استفساراتك.</p>
          </div>

          <div className="store-footer-column store-footer-barcode">
            <h2>الباركود</h2>
            {barcodeImageUrl ? (
              <img src={barcodeImageUrl} alt="باركود أرض الجوال" width={150} height={150} loading="lazy" />
            ) : barcodeRemoved ? (
              <span className="store-footer-muted">تم حذف الباركود من الإدارة.</span>
            ) : (
              <div className="footer-demo-barcode" aria-label="باركود أرض الجوال">
                <svg viewBox="0 0 180 112" role="img" aria-label="باركود أرض الجوال"><rect width="180" height="112" rx="8" fill="#fff"/><g fill="#202020">{Array.from({length: 42}, (_, i) => <rect key={i} x={7 + i * 3.95} y={7 + (i % 3)} width={i % 7 === 0 ? 2.8 : i % 4 === 0 ? 2.2 : 1.25} height={i % 5 === 0 ? 68 : i % 3 === 0 ? 76 : 62} />)}</g><rect x="56" y="31" width="68" height="28" rx="5" fill="#fff" stroke="#b28b37" strokeWidth="1.5"/><text x="90" y="49" fontSize="12" fontWeight="800" fill="#97712e" textAnchor="middle">أرض الجوال</text></svg>
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
