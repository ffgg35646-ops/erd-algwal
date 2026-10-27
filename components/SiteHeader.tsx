'use client';

import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import CustomerNotifications from '@/components/CustomerNotifications';

export default function SiteHeader() {
  const { itemCount } = useCart();

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
