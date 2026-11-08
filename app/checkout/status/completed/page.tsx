export const metadata = { title: 'حالة الطلب | أرض الجوال' };

export default function CompletedStatusPage() {
  return (
    <main dir="rtl" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, overflow: 'hidden', background: 'linear-gradient(135deg,#fff7ed,#fff 52%,#f0fdfa)', color: '#183b3a', fontFamily: 'inherit' }}>
      <section style={{ position: 'relative', width: '100%', maxWidth: 470, padding: '44px 28px', borderRadius: 26, textAlign: 'center', background: '#ffffff', border: '1px solid #dcece7', boxShadow: '0 20px 65px rgba(20,90,80,.09)' }}>
        <div style={{ width: 94, height: 94, margin: '0 auto 22px', display: 'grid', placeItems: 'center', borderRadius: 30, background: 'linear-gradient(145deg,#d5faf0,#e9f8ff)', color: '#168b76', fontSize: 48 }}>✓</div>
        <div style={{ color: '#249b83', fontSize: 12, fontWeight: 800 }}>تم بنجاح</div>
        <h1 style={{ margin: '12px 0', fontSize: 30 }}>شكرًا لاختيارك أرض الجوال</h1>
        <p style={{ margin: 0, color: '#617a78', fontSize: 16, lineHeight: 2 }}>تم استلام طلبك وتحديث حالته. نتمنى لك تجربة تسوّق ممتعة.</p>
        <div style={{ marginTop: 28, display: 'inline-flex', padding: '10px 18px', borderRadius: 99, background: '#effaf6', color: '#24836f', fontSize: 13 }}>أرض الجوال · خدمة العملاء</div>
      </section>
    </main>
  );
}
