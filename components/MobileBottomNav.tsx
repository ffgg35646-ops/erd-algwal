'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/components/CartProvider';

type StoreSettings = { whatsappNumber?: string };

function WhatsAppLink() {
  const [href, setHref] = useState('/#store-site-footer');

  useEffect(() => {
    let active = true;
    fetch('/api/store-settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as StoreSettings;
        const digits = (data.whatsappNumber || '').replace(/\D/g, '');
        if (active && /^\d{10,15}$/.test(digits)) {
          setHref('https://wa.me/' + digits);
        }
      })
      .catch(() => {
        // The footer remains available if settings cannot be loaded.
      });
    return () => { active = false; };
  }, []);

  return (
    <a
      href={href}
      target={href.startsWith('https://') ? '_blank' : undefined}
      rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined}
      className="mobile-bottom-nav-item mobile-bottom-nav-support"
      aria-label="التواصل مع الدعم"
    >
      <NavIcon name="support" />
      <span>الدعم</span>
    </a>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();

  function openCategories() {
    window.dispatchEvent(new Event('store-open-categories'));
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="التنقل الرئيسي">
      <WhatsAppLink />
      <button
        type="button"
        className="mobile-bottom-nav-item"
        onClick={openCategories}
        aria-label="فتح التصنيفات"
      >
        <NavIcon name="categories" />
        <span>التصنيفات</span>
      </button>
      <Link
        href="/"
        className={'mobile-bottom-nav-item' + (pathname === '/' ? ' is-active' : '')}
        aria-current={pathname === '/' ? 'page' : undefined}
      >
        <NavIcon name="home" />
        <span>الرئيسية</span>
      </Link>
      <Link
        href="/cart"
        className={'mobile-bottom-nav-item' + (pathname === '/cart' ? ' is-active' : '')}
        aria-current={pathname === '/cart' ? 'page' : undefined}
        aria-label={'السلة، ' + itemCount + ' قطعة'}
      >
        <span className="mobile-bottom-nav-cart-icon">
          <NavIcon name="cart" />
          <b className="mobile-bottom-nav-badge">{itemCount > 99 ? '99+' : itemCount}</b>
        </span>
        <span>السلة</span>
      </Link>
      <Link
        href="/account"
        className={'mobile-bottom-nav-item mobile-bottom-nav-account' + (pathname === '/account' ? ' is-active' : '')}
        aria-current={pathname === '/account' ? 'page' : undefined}
        aria-label="حسابي"
      >
        <NavIcon name="account" />
        <span>حسابي</span>
      </Link>
    </nav>
  );
}

function NavIcon({ name }: { name: 'support' | 'categories' | 'home' | 'cart' | 'account' }) {
  const common = {
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    focusable: false as const
  };

  switch (name) {
    case 'support':
      return <svg {...common}><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 9c1.2 2.6 2.2 3.6 4.8 5" /></svg>;
    case 'categories':
      return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>;
    case 'home':
      return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" /></svg>;
    case 'cart':
      return <svg {...common}><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg>;
    case 'account':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>;
  }
}
