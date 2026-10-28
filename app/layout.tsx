import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import SiteHeader from '@/components/SiteHeader';
import WhatsAppSupport from '@/components/WhatsAppSupport';
import StoreFooter from '@/components/StoreFooter';
import MobileBottomNav from '@/components/MobileBottomNav';

export const metadata: Metadata = {
  title: 'أرض الجوال | متجر الجوالات والإكسسوارات',
  description: 'أرض الجوال — تصفح الجوالات والأجهزة وملحقاتها واختر المنتجات التي تناسبك.',
  applicationName: 'أرض الجوال'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="mobile-app-shell">
          <CartProvider>
            <SiteHeader />
            {children}
            <StoreFooter />
            <WhatsAppSupport />
            <MobileBottomNav />
          </CartProvider>
        </div>
      </body>
    </html>
  );
}
