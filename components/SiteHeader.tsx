'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import CustomerNotifications from '@/components/CustomerNotifications';

export default function SiteHeader() {
  const { itemCount, catalogCategories, catalogProducts } = useCart();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoryNames = catalogCategories.length
    ? catalogCategories.map((category) => category.name)
    : Array.from(new Set(catalogProducts.map((product) => product.category))).filter(Boolean);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="أرض الجوال - الرئيسية">
          <span className="brand-mark store-brand-logo"><svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><rect x="10" y="5" width="23" height="34" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2.1"/><path d="M16 10h11M18 33h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M35 5.5l2.2 5.2 5.2 2.2-5.2 2.2-2.2 5.2-2.2-5.2-5.2-2.2 5.2-2.2z" fill="currentColor" transform="translate(-1 0) scale(.9)"/></svg></span>
          <span className="brand-copy">
            <strong>أرض الجوال</strong>
            <small>اختيارك الذكي للجوال</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <Link href="/" className="nav-glass-button" onClick={() => setCategoriesOpen(false)}>الرئيسية</Link>
          <div className="nav-category-menu">
            <button type="button" className="nav-glass-button nav-category-trigger" aria-expanded={categoriesOpen} aria-controls="site-category-dropdown" onClick={() => setCategoriesOpen((value) => !value)}>
              الأقسام <span aria-hidden="true">{categoriesOpen ? '⌃' : '⌄'}</span>
            </button>
            {categoriesOpen ? (
              <div id="site-category-dropdown" className="nav-category-dropdown">
                {categoryNames.length ? categoryNames.map((name) => (
                  <Link key={name} href={'/#category-' + encodeURIComponent(name)} onClick={() => setCategoriesOpen(false)}>{name}</Link>
                )) : <span>لم تُضف أقسام بعد</span>}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="header-actions">
          <CustomerNotifications />
          <Link href="/cart" className="header-cart" aria-label="سلة المشتريات">
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
  );
}
