'use client';

import { useEffect, useState } from 'react';

type StoreBanner = {
  id: string;
  imageUrl: string;
  alt: string;
};

const DEFAULT_BANNERS: StoreBanner[] = [
  {
    "id": "default-1",
    "imageUrl": "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1600&q=85",
    "alt": "هواتف ذكية"
  },
  {
    "id": "default-2",
    "imageUrl": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1600&q=85",
    "alt": "تشكيلة الجوالات"
  },
  {
    "id": "default-3",
    "imageUrl": "https://images.unsplash.com/photo-1610945265064-0e34e5519bb?auto=format&fit=crop&w=1600&q=85",
    "alt": "تصاميم الهواتف"
  },
  {
    "id": "default-4",
    "imageUrl": "https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=1600&q=85",
    "alt": "هواتف حديثة"
  },
  {
    "id": "default-5",
    "imageUrl": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1600&q=85",
    "alt": "عالم الجوالات"
  },
  {
    "id": "default-6",
    "imageUrl": "https://images.unsplash.com/photo-1603891128711-11b4b03bb138?auto=format&fit=crop&w=1600&q=85",
    "alt": "إكسسوارات الجوال"
  }
];

export default function StoreBannerSlider() {
  const [banners, setBanners] = useState<StoreBanner[]>(DEFAULT_BANNERS);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/store-banners', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { banners?: StoreBanner[] };
        if (!alive || !Array.isArray(data.banners)) return;
        setBanners(data.banners.length ? data.banners : DEFAULT_BANNERS);
        setActiveIndex((current) => (data.banners!.length || DEFAULT_BANNERS.length) ? current % (data.banners!.length || DEFAULT_BANNERS.length) : 0);
      } catch {
        // Leave the existing slider visible during brief connection failures.
      }
    };

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
    if (banners.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 6_000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) return (
    <section className="store-promo-slider container" aria-label="العروض والإعلانات">
      <div className="store-promo-empty" role="status"><span>أرض الجوال</span><strong>مساحة العروض والإعلانات</strong><p>تظهر صور السلايدر هنا بمجرد إضافتها من البوت: تعديلات أخرى ← السلايدر ← إضافة صورة.</p></div>
    </section>
  );
  const active = banners[activeIndex];
  if (!active) return null;

  function show(index: number) {
    setActiveIndex((index + banners.length) % banners.length);
  }

  return (
    <section className="store-promo-slider container" aria-label="العروض والإعلانات">
      <div className="store-promo-frame">
        {banners.map((banner, index) => (
          <div className="store-promo-slide" key={banner.id} aria-hidden={index !== activeIndex}>
            <img
              src={banner.imageUrl}
              alt={banner.alt}
              loading={index === activeIndex ? 'eager' : 'lazy'}
              fetchPriority={index === activeIndex ? 'high' : 'auto'}
            />
          </div>
        ))}
        {banners.length > 1 ? (
          <>
            <button type="button" className="store-promo-arrow store-promo-prev" onClick={() => show(activeIndex - 1)} aria-label="العرض السابق">‹</button>
            <button type="button" className="store-promo-arrow store-promo-next" onClick={() => show(activeIndex + 1)} aria-label="العرض التالي">›</button>
            <div className="store-promo-dots" aria-label="اختر العرض">
              {banners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  className={index === activeIndex ? 'is-active' : ''}
                  aria-label={'عرض رقم ' + (index + 1)}
                  aria-pressed={index === activeIndex}
                  onClick={() => show(index)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
