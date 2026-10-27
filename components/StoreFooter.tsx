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
    { key: 'returns', title: 'الاستبدال والاسترجاع' },
    { key: 'privacy', title: 'سياسة الخصوصية' },
    { key: 'terms', title: 'الشروط والأحكام' }
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
          const data = await settingsResponse.json() as { whatsappNumber?: string };
          if (alive && typeof data.whatsappNumber === 'string') setWhatsappNumber(data.whatsappNumber);
        }
      } catch {
        // Keep the fallback links working if settings cannot be loaded.
      }
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
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
            <p>متجرك للجوالات وملحقاتها.</p>
            <small>© {new Date().getFullYear()} أرض الجوال. جميع الحقوق محفوظة.</small>
          </div>

          <nav className="store-footer-column" aria-label="السياسات">
            <h2>السياسات</h2>
            {PAGE_LINKS.policies.map((page) => (
              <button type="button" key={page.key} onClick={() => setSelectedKey(page.key)}>{page.title}</button>
            ))}
          </nav>

          <nav className="store-footer-column" aria-label="خدمات العملاء">
            <h2>خدمات العملاء</h2>
            {PAGE_LINKS['customer-service'].map((page) => (
              <button type="button" key={page.key} onClick={() => setSelectedKey(page.key)}>{page.title}</button>
            ))}
          </nav>

          <div className="store-footer-column store-footer-contact">
            <h2>تواصل معنا</h2>
            <p>نسعد بخدمتك ومتابعة استفساراتك.</p>
            {whatsappNumber ? (
              <a href={'https://wa.me/' + whatsappNumber} target="_blank" rel="noreferrer">واتساب المتجر <span aria-hidden="true">↗</span></a>
            ) : (
              <span className="store-footer-muted">يمكنك التواصل معنا من خلال أيقونة واتساب بالموقع.</span>
            )}
          </div>
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
