'use client';

import { useEffect, useRef, useState } from 'react';

type StoreBanner = {
  id: string;
  imageUrl: string;
  alt: string;
};

export default function StoreBannerSlider() {
  // Start empty so hard-coded/previous banners never flash before the live list loads.
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const bannerSignatureRef = useRef<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(1);
  const [trackTransitionEnabled, setTrackTransitionEnabled] = useState(true);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/store-banners', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { banners?: StoreBanner[] };
        if (!alive || !Array.isArray(data.banners)) return;

        const nextBanners = data.banners;
        const nextSignature = JSON.stringify(nextBanners);
        if (bannerSignatureRef.current !== nextSignature) {
          // Apply the complete current list together, and restart from its first image.
          bannerSignatureRef.current = nextSignature;
          setBanners(nextBanners);
          setActiveIndex(0);
          setTrackTransitionEnabled(false);
          setTrackIndex(nextBanners.length > 1 ? 1 : 0);
        }
      } catch {
        // Keep the last successfully loaded list during a brief connection failure.
      } finally {
        if (alive) setHasLoaded(true);
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
    if (trackTransitionEnabled) return;
    const frame = window.requestAnimationFrame(() => setTrackTransitionEnabled(true));
    return () => window.cancelAnimationFrame(frame);
  }, [trackTransitionEnabled]);

  if (!banners.length) return (
    <section className="store-promo-slider container" aria-label="العروض والإعلانات">
      {hasLoaded ? (
        <div className="store-promo-empty" role="status"><span>عروض المتجر</span><strong>مساحة العروض والإعلانات</strong><p>تظهر صور السلايدر هنا بمجرد إضافتها من البوت: تعديلات أخرى ← السلايدر ← إضافة صورة.</p></div>
      ) : (
        <div className="store-promo-empty" role="status"><span>عروض المتجر</span><strong>جارٍ تحميل الصور الحالية</strong></div>
      )}
    </section>
  );
  const active = banners[activeIndex];
  if (!active) return null;

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
      <div
        className="store-promo-frame"
      >
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
            return (
              <div className="store-promo-slide" key={item.key} aria-hidden={index !== displayedTrackIndex}>
                <img
                  src={banner.imageUrl}
                  alt={banner.alt}
                  loading={index === displayedTrackIndex ? 'eager' : 'lazy'}
                  fetchPriority={index === displayedTrackIndex ? 'high' : 'auto'}
                  onError={(event) => {
                    // Never replace a failed current banner with an unrelated old/default photo.
                    event.currentTarget.style.visibility = 'hidden';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
