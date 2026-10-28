'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useCart } from '@/components/CartProvider';
import CustomerNotifications from '@/components/CustomerNotifications';

export default function SiteHeader() {
  const { itemCount, catalogCategories, catalogProducts } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  const categoryNames = catalogCategories.length
    ? catalogCategories.map((category) => category.name)
    : Array.from(new Set(catalogProducts.map((product) => product.category))).filter(Boolean);

  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get('q') || '');
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
      <div className="store-utility-bar">
        <div className="container store-utility-inner">
          <span>تسوق بسهولة • خيارات متنوعة من الأجهزة والملحقات</span>
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

          <form className="header-search" role="search" onSubmit={submitSearch}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="ابحث عن المنتجات أو الماركات أو الفئات..."
              aria-label="ابحث عن منتج"
            />
            {search ? (
              <button type="button" className="header-search-clear" aria-label="مسح البحث" onClick={() => updateSearch('')}>×</button>
            ) : null}
          </form>

          <div className="header-actions">
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
      </header>

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
