export const metadata = { title: 'متابعة الطلب | أرض الجوال' };

export default function BalanceStatusPage() {
  return (
    <main dir="rtl" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, background: '#17212b', color: '#f7fafc', fontFamily: 'inherit' }}>
      <section style={{ width: '100%', maxWidth: 490, padding: '42px 30px', textAlign: 'center', borderRadius: 8, border: '1px solid #43515e', background: 'linear-gradient(155deg,#253441,#1b2732)', boxShadow: '0 26px 80px rgba(0,0,0,.3)' }}>
        <div style={{ width: 76, height: 76, margin: '0 auto 24px', display: 'grid', placeItems: 'center', border: '1px solid #718292', borderRadius: '50%', color: '#b8d4df', fontSize: 34 }}>✓</div>
        <span style={{ color: '#9bb7c5', fontSize: 12, letterSpacing: 2 }}>ORDER UPDATE</span>
        <h1 style={{ margin: '15px 0', fontSize: 28, fontWeight: 700 }}>تم تسجيل طلبك</h1>
        <p style={{ margin: 0, color: '#c4d0d8', fontSize: 16, lineHeight: 2 }}>استلمنا طلبك وأضفناه إلى قائمة المتابعة. نقدر صبرك واهتمامك.</p>
        <div style={{ height: 3, marginTop: 32, borderRadius: 9, background: 'linear-gradient(90deg,#9bc7d4,#557d91,#9bc7d4)' }} />
      </section>
    </main>
  );
}
