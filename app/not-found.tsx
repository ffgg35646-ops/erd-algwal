import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container not-found">
      <span>404</span>
      <h1>الصفحة غير موجودة</h1>
      <p>يمكنك الرجوع للمتجر ومتابعة تصفح المنتجات.</p>
      <Link href="/" className="primary-button">العودة للرئيسية</Link>
    </main>
  );
}
