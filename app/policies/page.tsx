import Link from 'next/link';

export default function PoliciesPage() {
  return (
    <main className="container policy-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><span>سياسات المتجر</span></div>
      <section className="policy-card">
        <span className="section-kicker">المتجر</span>
        <h1>سياسة الضمان والاسترجاع والتوصيل</h1>
        <p>هذه الصفحة مخصصة لعرض سياسة الضمان والاسترجاع والتوصيل التي سيعتمدها صاحب المتجر.</p>
        <div className="policy-pending">السياسة النهائية لم تُقدَّم بعد، ولذلك لم نضع شروطًا أو مدد ضمان واسترجاع من عندنا. يجب إضافة الشروط المعتمدة قبل تفعيل استقبال الطلبات الفعلية.</div>
        <p><Link href="/checkout/store">العودة إلى بيانات التوصيل</Link></p>
      </section>
    </main>
  );
}
