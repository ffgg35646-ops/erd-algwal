export const metadata = { title: 'حالة الطلب | أرض الجوال' };

export default function CompletedStatusPage() {
  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        backgroundColor: '#ffffff',
        color: '#1a2b3c',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        
        {/* الشعار العلوي */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
          <b style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.1, color: '#1a2b3c' }}>
            <span style={{ display: 'block' }}>أرض</span>
            الجوال
          </b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ width: '22px', height: '14px', backgroundColor: '#1a2b3c', borderRadius: '4px' }} />
            <div style={{ width: '22px', height: '14px', backgroundColor: '#2fbf9b', borderRadius: '4px' }} />
          </div>
        </div>

        {/* أيقونة الصح الأخضر */}
        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: '#e1f6ed' }} />
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', backgroundColor: '#00b493', color: '#fff', fontSize: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            ✓
          </div>
          <span style={{ position: 'absolute', top: '24px', right: '-12px', width: '12px', height: '4px', backgroundColor: '#2fbf9b', borderRadius: '2px', transform: 'rotate(25deg)' }} />
          <span style={{ position: 'absolute', top: '48px', right: '-12px', width: '12px', height: '4px', backgroundColor: '#2fbf9b', borderRadius: '2px', transform: 'rotate(-25deg)' }} />
          <span style={{ position: 'absolute', top: '24px', left: '-12px', width: '12px', height: '4px', backgroundColor: '#2fbf9b', borderRadius: '2px', transform: 'rotate(-25deg)' }} />
          <span style={{ position: 'absolute', top: '48px', left: '-12px', width: '12px', height: '4px', backgroundColor: '#2fbf9b', borderRadius: '2px', transform: 'rotate(25deg)' }} />
        </div>

        {/* العناوين والرسائل */}
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0d233a', margin: '0 0 10px 0' }}>
          تم اعتماد طلبك
        </h1>

        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e63946', margin: '0 0 12px 0' }}>
          بنجاح
        </h2>

        <p style={{ fontSize: '18px', fontWeight: 600, color: '#1a2b3c', margin: '0 0 28px 0' }}>
          سيتم معالجة طلبك قريباً
        </p>

        {/* الصندوق السفلي */}
        <div style={{ backgroundColor: '#eef9f6', border: '1px solid #bcece0', borderRadius: '20px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', width: '110px', height: '70px', backgroundColor: '#1e293b', borderRadius: '10px', padding: '8px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ width: '16px', height: '12px', backgroundColor: '#fbbf24', borderRadius: '2px' }} />
            <div style={{ display: 'flex', gap: '3px' }}>
              <div style={{ width: '8px', height: '2px', backgroundColor: '#64748b' }} />
              <div style={{ width: '8px', height: '2px', backgroundColor: '#64748b' }} />
              <div style={{ width: '8px', height: '2px', backgroundColor: '#64748b' }} />
            </div>
            <div style={{ position: 'absolute', bottom: '-8px', right: '-8px', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#00b493', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px' }}>
              ✓
            </div>
          </div>

          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a2b3c', marginBottom: '4px' }}>
              حالة الطلب
            </div>
            <div style={{ fontSize: '13px', color: '#0f766e', fontWeight: 700 }}>
              تم الاعتماد بنجاح
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
