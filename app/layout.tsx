import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'أرض الجوال | متجر الجوالات والإكسسوارات',
  description: 'تصفح الجوالات وملحقاتها في متجر أرض الجوال.',
  applicationName: 'أرض الجوال'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <CartProvider>
          <SiteHeader />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
