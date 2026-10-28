'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import CustomerNotifications from '@/components/CustomerNotifications';

export default function SiteHeader() {
  const { itemCount, catalogCategories, catalogProducts } = useCart();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoryNames = Array.from(new Set([...catalogCategories.map((category) => category.name), ...catalogProducts.map((product) => product.category)])).filter(Boolean);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="أرض الجوال - الرئيسية">
          <span className="brand-mark" aria-hidden="true">أ</span>
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
