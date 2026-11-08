export const metadata = { title: 'انتهت مهلة الانتظار | أرض الجوال' };

export default function TimeoutStatusPage() {
  return (
    <main dir="rtl" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, background: '#f2f3f5', color: '#303943', fontFamily: 'inherit' }}>
      <section style={{ width: '100%', maxWidth: 460, padding: '42px 28px', textAlign: 'center', background: '#fff', borderRadius: 18, border: '1px solid #e1e5e9', boxShadow: '0 16px 48px rgba(30,40,50,.07)' }}>
        <div style={{ width: 82, height: 82, margin: '0 auto 22px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#eef0f3', color: '#66717d', fontSize: 36 }}>⌛</div>
        <p style={{ margin: 0, color: '#87919b', fontSize: 12, fontWeight: 800 }}>أرض الجوال</p>
        <h1 style={{ margin: '14px 0', fontSize: 27 }}>انتهت مهلة الانتظار</h1>
        <p style={{ margin: 0, color: '#68727c', fontSize: 16, lineHeight: 2 }}>لم يصل تحديث خلال الوقت المحدد. يمكنك متابعة طلبك من خلال خدمة العملاء.</p>
      </section>
    </main>
  );
}
