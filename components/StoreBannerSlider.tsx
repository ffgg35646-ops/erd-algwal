'use client';

import { useEffect, useState } from 'react';

type StoreBanner = {
  id: string;
  imageUrl: string;
  alt: string;
};

export default function StoreBannerSlider() {
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/store-banners', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { banners?: StoreBanner[] };
        if (!alive || !Array.isArray(data.banners)) return;
        setBanners(data.banners);
        setActiveIndex((current) => data.banners!.length ? current % data.banners!.length : 0);
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

  if (!banners.length) return null;
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
