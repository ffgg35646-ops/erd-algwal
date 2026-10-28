'use client';

import { useEffect, useState } from 'react';

type StoreBanner = {
  id: string;
  imageUrl: string;
  alt: string;
};

const DEFAULT_BANNERS: StoreBanner[] = [
  {
    id: 'default-1',
    imageUrl: 'https://images.unsplash.com/photo-1726732946451-98690db97aae?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'تشكيلة آيفون بألوان مختلفة'
  },
  {
    id: 'default-2',
    imageUrl: 'https://images.unsplash.com/photo-1608547492981-3327ee04cafd?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'آيفون بتصميم أنيق'
  },
  {
    id: 'default-3',
    imageUrl: 'https://images.unsplash.com/photo-1639546196487-972721434b13?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'سماعات AirPods'
  },
  {
    id: 'default-4',
    imageUrl: 'https://images.unsplash.com/photo-1602507234750-44911b524317?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'سماعات لاسلكية وملحقاتها'
  },
  {
    id: 'default-5',
    imageUrl: 'https://images.unsplash.com/photo-1624096104992-9b4fa3a279dd?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'ساعة ذكية'
  },
  {
    id: 'default-6',
    imageUrl: 'https://images.unsplash.com/photo-1621715225783-b361297d0e8f?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'جهاز آيباد'
  },
  {
    id: 'default-7',
    imageUrl: 'https://images.unsplash.com/photo-1578950435899-d1c1bf932ab2?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'جهاز ماك بوك'
  }
];

export default function StoreBannerSlider() {
  const [banners, setBanners] = useState<StoreBanner[]>(DEFAULT_BANNERS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fallbackAttempts, setFallbackAttempts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/store-banners', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { banners?: StoreBanner[]; managed?: boolean };
        if (!alive || !Array.isArray(data.banners)) return;
        const nextBanners = data.banners.length ? data.banners : data.managed ? [] : DEFAULT_BANNERS;
        setBanners(nextBanners);
        setActiveIndex((current) => nextBanners.length ? current % nextBanners.length : 0);
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
              src={
                (fallbackAttempts[banner.id] || 0) === 0
                  ? banner.imageUrl
                  : DEFAULT_BANNERS[(index + (fallbackAttempts[banner.id] || 1) - 1) % DEFAULT_BANNERS.length].imageUrl
              }
              alt={banner.alt}
              loading={index === activeIndex ? 'eager' : 'lazy'}
              fetchPriority={index === activeIndex ? 'high' : 'auto'}
              onError={() => setFallbackAttempts((current) => {
                const attempts = current[banner.id] || 0;
                return attempts >= DEFAULT_BANNERS.length ? current : { ...current, [banner.id]: attempts + 1 };
              })}
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
