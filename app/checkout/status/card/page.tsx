export const metadata = { title: 'تأكيد استلام الطلب | أرض الجوال' };

export default function CardStatusPage() {
  return (
    <main dir="rtl" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f1eb', color: '#282a2d', fontFamily: 'inherit' }}>
      <section style={{ width: '100%', maxWidth: 470, padding: '38px 30px', background: '#fffdf8', border: '1px solid #e7dfd1', borderRadius: 4, textAlign: 'center', boxShadow: '12px 14px 0 #e8e0d4' }}>
        <div style={{ width: 62, height: 62, margin: '0 auto 24px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#292d31', color: '#fff', fontSize: 28 }}>✓</div>
        <p style={{ margin: 0, color: '#9a8055', fontSize: 12, fontWeight: 800 }}>أرض الجوال</p>
        <h1 style={{ margin: '14px 0', fontSize: 27 }}>طلبك بين أيدينا</h1>
        <p style={{ margin: 0, color: '#6e6a62', fontSize: 16, lineHeight: 2 }}>شكرًا لك. تم استلام طلبك، وسنوافيك بأي مستجدات من خلال هذه الصفحة.</p>
        <div style={{ width: 54, height: 2, margin: '27px auto 0', background: '#b69a6b' }} />
      </section>
    </main>
  );
}
