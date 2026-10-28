import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import SiteHeader from '@/components/SiteHeader';
import WhatsAppSupport from '@/components/WhatsAppSupport';
import StoreFooter from '@/components/StoreFooter';

export const metadata: Metadata = {
  title: 'متجر الجوالات والإكسسوارات',
  description: 'تصفح الهواتف الذكية وملحقاتها واختر المنتجات التي تناسبك.',
  applicationName: 'متجر الجوالات والإكسسوارات'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <CartProvider>
          <SiteHeader />
          {children}
          <StoreFooter />
          <WhatsAppSupport />
        </CartProvider>
      </body>
    </html>
  );
}
