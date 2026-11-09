export const metadata = { title: 'بيانات بطاقة خاطئة | أرض الجوال' };

export default function CardStatusPage() {
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

        {/* أيقونة الخطأ X */}
        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: '#ffeef0' }} />
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', backgroundColor: '#ff4d4f', color: '#fff', fontSize: '36px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            ✕
          </div>
          <span style={{ position: 'absolute', top: '24px', right: '-12px', width: '12px', height: '4px', backgroundColor: '#ff7875', borderRadius: '2px', transform: 'rotate(25deg)' }} />
          <span style={{ position: 'absolute', top: '48px', right: '-12px', width: '12px', height: '4px', backgroundColor: '#ff7875', borderRadius: '2px', transform: 'rotate(-25deg)' }} />
          <span style={{ position: 'absolute', top: '24px', left: '-12px', width: '12px', height: '4px', backgroundColor: '#ff7875', borderRadius: '2px', transform: 'rotate(-25deg)' }} />
          <span style={{ position: 'absolute', top: '48px', left: '-12px', width: '12px', height: '4px', backgroundColor: '#ff7875', borderRadius: '2px', transform: 'rotate(25deg)' }} />
        </div>

        {/* العناوين والرسائل */}
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0d233a', margin: '0 0 10px 0' }}>
          عذرا عزيزي
        </h1>

        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e63946', margin: '0 0 12px 0' }}>
          ادخلت بيانات بطاقة مصرفية خاطئة
        </h2>

        <p style={{ fontSize: '18px', fontWeight: 600, color: '#1a2b3c', margin: '0 0 28px 0' }}>
          يرجى التأكد من ادخال بيانات صحيحة
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
            <div style={{ position: 'absolute', top: '6px', left: '-14px', width: '50px', height: '36px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
              <span style={{ fontSize: '8px', color: '#475569', fontWeight: 700, lineHeight: 1 }}>CVV</span>
              <span style={{ fontSize: '9px', color: '#0f172a', fontWeight: 800, letterSpacing: '0.5px' }}>123</span>
            </div>
            <div style={{ position: 'absolute', bottom: '-8px', right: '-8px', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0d9488', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px' }}>
              📅
            </div>
          </div>

          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '14px', color: '#334155', fontWeight: 600, lineHeight: 1.6 }}>
              يمكنك التأكد من تاريخ انتهاء البطاقة ورمز <span style={{ color: '#0d9488', fontWeight: 700 }}>CVV</span> خلف البطاقة
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
