export const metadata = { title: 'تحديث الطلب | أرض الجوال' };

export default function OtpStatusPage() {
  return (
    <main dir="rtl" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: '24px', background: 'radial-gradient(circle at 15% 15%, #d9f5ee 0, transparent 32%), linear-gradient(145deg,#f7faf9,#eaf1ef)', color: '#18352f', fontFamily: 'inherit' }}>
      <section style={{ width: '100%', maxWidth: 470, textAlign: 'center', padding: '42px 28px', borderRadius: 30, background: 'rgba(255,255,255,.86)', border: '1px solid #d9e9e3', boxShadow: '0 24px 70px rgba(32,91,73,.10)' }}>
        <div style={{ width: 88, height: 88, margin: '0 auto 24px', display: 'grid', placeItems: 'center', borderRadius: 28, background: '#e1f6ed', color: '#16845f', fontSize: 42 }}>✓</div>
        <p style={{ margin: '0 0 10px', color: '#16845f', fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>أرض الجوال · تحديث الطلب</p>
        <h1 style={{ margin: '0 0 14px', fontSize: 29, lineHeight: 1.5 }}>وصلنا طلبك بنجاح</h1>
        <p style={{ margin: 0, color: '#60766e', fontSize: 17, lineHeight: 2 }}>تم استلام طلبك، ويجري الآن مراجعته. شكرًا لثقتك بنا.</p>
        <div style={{ marginTop: 30, padding: '13px 16px', borderRadius: 14, background: '#f0f8f4', color: '#477263', fontSize: 13 }}>يمكنك إبقاء هذه الصفحة مفتوحة.</div>
      </section>
    </main>
  );
}
