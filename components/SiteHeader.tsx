'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';

export default function SiteHeader() {
  const { itemCount } = useCart();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
          <Link href="/">الرئيسية</Link>
          <Link href="/#categories">الأقسام</Link>
          <Link href="/#products">المنتجات</Link>
        </nav>

        <div className="header-actions">
          <div className="notification-wrap">
            <button
              type="button"
              className="header-icon-button notification-button"
              aria-label="الإشعارات"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
            </button>
            {notificationsOpen ? (
              <div className="notification-popover" role="status">
                <strong>الإشعارات</strong>
                <p>لا توجد إشعارات لعرضها حاليًا.</p>
              </div>
            ) : null}
          </div>

          <Link href="/cart" className="header-icon-button header-cart" aria-label={'سلة المشتريات، ' + itemCount + ' منتج'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
              <circle cx="10" cy="20" r="1.2" />
              <circle cx="18" cy="20" r="1.2" />
            </svg>
            <b className="cart-count">{itemCount}</b>
          </Link>
        </div>
      </div>
    </header>
  );
}
