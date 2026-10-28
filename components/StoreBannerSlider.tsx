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
  const [trackIndex, setTrackIndex] = useState(1);
  const [trackTransitionEnabled, setTrackTransitionEnabled] = useState(true);
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
      const nextIndex = (activeIndex + 1) % banners.length;
      setActiveIndex(nextIndex);
      setTrackTransitionEnabled(true);
      setTrackIndex(activeIndex === banners.length - 1 ? banners.length + 1 : nextIndex + 1);
    }, 6_000);
    return () => window.clearInterval(timer);
  }, [banners.length, activeIndex]);

  useEffect(() => {
    setTrackTransitionEnabled(false);
    setTrackIndex(banners.length > 1 ? activeIndex + 1 : 0);
  }, [banners.length]);

  useEffect(() => {
    if (trackTransitionEnabled) return;
    const frame = window.requestAnimationFrame(() => setTrackTransitionEnabled(true));
    return () => window.cancelAnimationFrame(frame);
  }, [trackTransitionEnabled]);

  if (!banners.length) return (
    <section className="store-promo-slider container" aria-label="العروض والإعلانات">
      <div className="store-promo-empty" role="status"><span>عروض المتجر</span><strong>مساحة العروض والإعلانات</strong><p>تظهر صور السلايدر هنا بمجرد إضافتها من البوت: تعديلات أخرى ← السلايدر ← إضافة صورة.</p></div>
    </section>
  );
  const active = banners[activeIndex];
  if (!active) return null;

  function show(index: number) {
    const nextIndex = (index + banners.length) % banners.length;
    setActiveIndex(nextIndex);
    setTrackTransitionEnabled(true);
    if (banners.length < 2) {
      setTrackIndex(0);
      return;
    }
    if (activeIndex === banners.length - 1 && nextIndex === 0) {
      setTrackIndex(banners.length + 1);
    } else if (activeIndex === 0 && nextIndex === banners.length - 1) {
      setTrackIndex(0);
    } else {
      setTrackIndex(nextIndex + 1);
    }
  }

  const sliderItems = banners.length > 1
    ? [
        { banner: banners[banners.length - 1], key: 'clone-prev-' + banners[banners.length - 1].id },
        ...banners.map((banner) => ({ banner, key: banner.id })),
        { banner: banners[0], key: 'clone-next-' + banners[0].id }
      ]
    : banners.map((banner) => ({ banner, key: banner.id }));

  const displayedTrackIndex = banners.length > 1 ? trackIndex : 0;

  return (
    <section className="store-promo-slider container" aria-label="العروض والإعلانات">
      <div className="store-promo-frame">
        <div
          className="store-promo-track"
          style={{
            transform: `translateX(-${displayedTrackIndex * 100}%)`,
            transition: trackTransitionEnabled ? undefined : 'none'
          }}
          onTransitionEnd={(event) => {
            if (event.propertyName !== 'transform' || banners.length < 2) return;
            if (trackIndex === 0) {
              setTrackTransitionEnabled(false);
              setTrackIndex(banners.length);
            } else if (trackIndex === banners.length + 1) {
              setTrackTransitionEnabled(false);
              setTrackIndex(1);
            }
          }}
        >
          {sliderItems.map((item, index) => {
            const { banner } = item;
            const originalIndex = banners.findIndex((candidate) => candidate.id === banner.id);
            const fallbackIndex = originalIndex >= 0 ? originalIndex : (index === 0 ? banners.length - 1 : 0);
            const attempts = fallbackAttempts[banner.id] || 0;
            return (
              <div className="store-promo-slide" key={item.key} aria-hidden={index !== displayedTrackIndex}>
                <img
                  src={
                    attempts === 0
                      ? banner.imageUrl
                      : DEFAULT_BANNERS[(fallbackIndex + attempts - 1) % DEFAULT_BANNERS.length].imageUrl
                  }
                  alt={banner.alt}
                  loading={index === displayedTrackIndex ? 'eager' : 'lazy'}
                  fetchPriority={index === displayedTrackIndex ? 'high' : 'auto'}
                  onError={() => setFallbackAttempts((current) => {
                    const currentAttempts = current[banner.id] || 0;
                    return currentAttempts >= DEFAULT_BANNERS.length
                      ? current
                      : { ...current, [banner.id]: currentAttempts + 1 };
                  })}
                />
              </div>
            );
          })}
        </div>
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
