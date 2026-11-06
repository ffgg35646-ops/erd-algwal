'use client';

import Link from 'next/link';
import Image from 'next/image';
import siteLogo from '@/wrwerwe.jpg';
import { useEffect, useState, type FormEvent } from 'react';
import { useCart } from '@/components/CartProvider';
import CustomerNotifications from '@/components/CustomerNotifications';

async function removeFlatLogoBackground(source: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return source;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(source);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return source;
    context.drawImage(bitmap, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const buckets = new Map<string, { red: number; green: number; blue: number; count: number }>();
    let sampleCount = 0;
    const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 260));

    const addEdgeSample = (x: number, y: number) => {
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] < 180) return;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const key = [red >> 5, green >> 5, blue >> 5].join(':');
      const bucket = buckets.get(key) || { red: 0, green: 0, blue: 0, count: 0 };
      bucket.red += red;
      bucket.green += green;
      bucket.blue += blue;
      bucket.count += 1;
      buckets.set(key, bucket);
      sampleCount += 1;
    };

    for (let x = 0; x < width; x += sampleStep) {
      addEdgeSample(x, 0);
      addEdgeSample(x, height - 1);
    }
    for (let y = 0; y < height; y += sampleStep) {
      addEdgeSample(0, y);
      addEdgeSample(width - 1, y);
    }

    let dominant: { red: number; green: number; blue: number; count: number } | undefined;
    for (const bucket of buckets.values()) {
      if (!dominant || bucket.count > dominant.count) dominant = bucket;
    }
    if (!dominant || sampleCount === 0 || dominant.count / sampleCount < 0.25) return source;

    const backgroundRed = dominant.red / dominant.count;
    const backgroundGreen = dominant.green / dominant.count;
    const backgroundBlue = dominant.blue / dominant.count;
    const pixelCount = width * height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let queueStart = 0;
    let queueEnd = 0;
    const maxDistanceSquared = 84 * 84;

    const addIfBackground = (pixelIndex: number) => {
      if (visited[pixelIndex]) return;
      visited[pixelIndex] = 1;
      const offset = pixelIndex * 4;
      if (pixels[offset + 3] < 16) return;
      const red = pixels[offset] - backgroundRed;
      const green = pixels[offset + 1] - backgroundGreen;
      const blue = pixels[offset + 2] - backgroundBlue;
      if (red * red + green * green + blue * blue <= maxDistanceSquared) {
        queue[queueEnd++] = pixelIndex;
      }
    };

    for (let x = 0; x < width; x += 1) {
      addIfBackground(x);
      addIfBackground((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      addIfBackground(y * width);
      addIfBackground(y * width + width - 1);
    }

    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart++];
      const offset = pixelIndex * 4;
      const red = pixels[offset] - backgroundRed;
      const green = pixels[offset + 1] - backgroundGreen;
      const blue = pixels[offset + 2] - backgroundBlue;
      const distance = Math.sqrt(red * red + green * green + blue * blue);
      pixels[offset + 3] = distance <= 58
        ? 0
        : Math.round(pixels[offset + 3] * Math.min(1, (distance - 58) / 26));

      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      if (x > 0) addIfBackground(pixelIndex - 1);
      if (x + 1 < width) addIfBackground(pixelIndex + 1);
      if (y > 0) addIfBackground(pixelIndex - width);
      if (y + 1 < height) addIfBackground(pixelIndex + width);
    }

    context.putImageData(imageData, 0, 0);
    const transparentImage = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    return transparentImage || source;
  } catch {
    return source;
  } finally {
    bitmap?.close();
  }
}

export default function SiteHeader() {
  const { itemCount, catalogCategories, catalogProducts } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [logoSrc, setLogoSrc] = useState<string>(siteLogo.src);
  const [logoFilter, setLogoFilter] = useState<string>('url(#remove-logo-black)');

  const categoryNames = catalogCategories.length
    ? catalogCategories.map((category) => category.name)
    : Array.from(new Set(catalogProducts.map((product) => product.category))).filter(Boolean);

  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get('q') || '');
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    fetch('/api/store/logo', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const backgroundMode = response.headers.get('x-store-logo-background') || 'legacy';
        const sourceImage = await response.blob();
        const image = backgroundMode === 'without'
          ? await removeFlatLogoBackground(sourceImage)
          : sourceImage;
        if (!active) return;
        setLogoFilter(backgroundMode === 'legacy' ? 'url(#remove-logo-black)' : 'none');
        objectUrl = URL.createObjectURL(image);
        setLogoSrc(objectUrl);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    const openCategories = () => setMenuOpen(true);
    window.addEventListener('store-open-categories', openCategories);
    return () => window.removeEventListener('store-open-categories', openCategories);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  function updateSearch(value: string) {
    setSearch(value);
    if (window.location.pathname !== '/') return;
    window.dispatchEvent(new CustomEvent<string>('store-search', { detail: value }));
    const nextUrl = value.trim() ? '/?q=' + encodeURIComponent(value) : '/';
    window.history.replaceState(null, '', nextUrl);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (window.location.pathname === '/') {
      window.dispatchEvent(new CustomEvent<string>('store-search', { detail: query }));
      window.history.replaceState(null, '', query ? '/?q=' + encodeURIComponent(query) : '/');
      return;
    }
    window.location.href = query ? '/?q=' + encodeURIComponent(query) : '/';
  }

  return (
    <>
      <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="remove-logo-black" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 10 0 -0.06" />
          </filter>
        </defs>
      </svg>
      <div className="store-utility-bar">
        <div className="container store-utility-inner">
          <span>أرض الجوال • الجوالات والأجهزة وملحقاتها</span>
          <div className="store-utility-options">
            <a href="/#store-site-footer">خدمة العملاء</a>
            <span>الأسعار بالريال السعودي</span>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <button
            type="button"
            className="store-menu-toggle"
            aria-label="فتح قائمة الأقسام"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span>جميع الأقسام</span>
          </button>

          <Link href="/" className="store-reference-brand" aria-label="أرض الجوال - الرئيسية"><Image src={logoSrc} alt="أرض الجوال" width={500} height={500} priority unoptimized style={{ width: 120, height: 64, objectFit: 'cover', objectPosition: 'center', filter: logoFilter }} /></Link>

          <form className={"header-search" + (searchOpen ? " is-open" : "")} role="search" onSubmit={submitSearch}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="ابحث في أرض الجوال عن منتج أو فئة..."
              aria-label="ابحث عن منتج"
            />
            <button type="submit" className="header-search-submit">بحث</button>
            {search ? (
              <button type="button" className="header-search-clear" aria-label="مسح البحث" onClick={() => updateSearch('')}>×</button>
            ) : null}
          </form>

          <div className="header-actions">
            <button
              type="button"
              className="mobile-search-toggle"
              aria-label={searchOpen ? 'إغلاق البحث' : 'فتح البحث'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((current) => !current)}
            >
              {searchOpen ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
              )}
            </button>
            <div className="header-order-actions">
              <CustomerNotifications />
              <Link href="/cart" className="header-cart" aria-label={'سلة المشتريات، ' + itemCount + ' قطعة'}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
                  <circle cx="10" cy="20" r="1.2" />
                  <circle cx="18" cy="20" r="1.2" />
                </svg>
                <span>السلة</span>
                <b className="cart-count">{itemCount}</b>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <nav className="store-category-bar" aria-label="أقسام المتجر">
        <div className="container store-category-links">
          <Link href="/" className="store-category-link">الرئيسية</Link>
          {categoryNames.map((name) => (
            <Link key={name} href={'/#category-' + encodeURIComponent(name)} className="store-category-link">{name}</Link>
          ))}
        </div>
      </nav>

      {menuOpen ? (
        <div className="store-drawer-layer">
          <button type="button" className="store-drawer-backdrop" aria-label="إغلاق قائمة الأقسام" onClick={() => setMenuOpen(false)} />
          <aside className="store-drawer" aria-label="قائمة المتجر">
            <div className="store-drawer-heading">
              <strong>تصفح الأقسام</strong>
              <button type="button" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}>×</button>
            </div>
            <Link className="store-drawer-main-link" href="/" onClick={() => setMenuOpen(false)}>
              <span aria-hidden="true">⌂</span> الرئيسية
            </Link>
            <Link className="store-drawer-main-link" href="/account" onClick={() => setMenuOpen(false)}>
              <span aria-hidden="true">♙</span> حسابي
            </Link>
            <div className="store-drawer-section-title">أقسام المنتجات</div>
            <nav className="store-drawer-categories" aria-label="أقسام المنتجات">
              {categoryNames.length ? categoryNames.map((name) => (
                <Link key={name} href={'/#category-' + encodeURIComponent(name)} onClick={() => setMenuOpen(false)}>
                  <span aria-hidden="true">‹</span><span>{name}</span>
                </Link>
              )) : <p>ستظهر الأقسام هنا عند إضافتها.</p>}
            </nav>
            <Link className="store-drawer-main-link" href="/cart" onClick={() => setMenuOpen(false)}>
              <span aria-hidden="true">🛒</span> سلة المشتريات <b>{itemCount}</b>
            </Link>
            <a className="store-drawer-main-link" href="/#store-site-footer" onClick={() => setMenuOpen(false)}>
              <span aria-hidden="true">?</span> خدمة العملاء
            </a>
          </aside>
        </div>
      ) : null}
    </>
  );
}
