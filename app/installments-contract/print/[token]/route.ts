import { getDb } from '@/lib/mongodb';
import type { StoreOrder } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[character];
  });
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function getDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function formatContractDate(date: Date) {
  const { year, month, day } = getDateParts(date);
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function getFirstInstallmentDate(orderDate: Date) {
  const { year, month } = getDateParts(orderDate);
  const targetMonthIndex = month % 12;
  const targetYear = year + Math.floor(month / 12);
  return new Date(Date.UTC(targetYear, targetMonthIndex, 28));
}

function weekdayArabic(date: Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    timeZone: 'Asia/Riyadh'
  }).format(date);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    return new Response('العقد غير موجود.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  try {
    const db = await getDb();
    const order = await db.collection<StoreOrder>('orders').findOne({
      installmentContractToken: token,
      source: 'website',
      installment: true
    });

    if (!order) {
      return new Response('العقد غير موجود.', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    const orderDate = new Date(order.createdAt);
    const orderDateSafe = Number.isNaN(orderDate.getTime()) ? new Date() : orderDate;
    const firstInstallmentDate = getFirstInstallmentDate(orderDateSafe);
    const orderNumber = order.orderNumber || '#' + order._id.toString().slice(-6);
    const total = Math.max(0, Number(order.total) || 0);
    const downPayment = Math.min(total, Math.max(0, Number(order.installmentDownPayment) || 0));
    const remaining = Math.max(0, total - downPayment);
    const months = Math.max(1, Math.floor(Number(order.installmentMonths) || 1));
    const monthlyPayment = remaining / months;
    const customer = order.customer || { name: '', phone: '', address: '' };
    const products = (order.items || []).map((item) =>
      `${item.name || 'منتج'} × ${Math.max(1, Number(item.quantity) || 1)}`
    ).join('، ') || '—';
    const weekday = weekdayArabic(orderDateSafe);

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>عقد بيع بالتقسيط ${escapeHtml(orderNumber)} — أرض الجوال</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; margin: 0; padding: 12px 10px 28px; background: #f5f5f5; color: #111; }
  .print-btn { position: fixed; top: 12px; right: 12px; z-index: 2; background: #3f4a5c; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 13px; }
  .page { width: min(720px, 100%); margin: 48px auto 0; padding: 24px 22px; background: #fff; border: 1px solid #e0e0e0; }
  .header { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 0 0 16px; border-bottom: 1px solid #888; }
  .side { width: 36%; text-align: center; font-size: 12px; line-height: 1.7; }
  .side b { font-size: 17px; display: block; }
  .logo { width: 24%; min-height: 60px; display: flex; align-items: center; justify-content: center; border: 1px solid #9ca3af; padding: 10px 6px; color: #3f4a5c; font-size: 18px; font-weight: 800; line-height: 1.35; text-align: center; }
  h1 { text-align: center; font-size: 25px; margin: 26px 0 20px; }
  .meta { display: flex; flex-wrap: wrap; gap: 10px 24px; font-weight: bold; font-size: 13px; margin-bottom: 18px; }
  p { font-size: 14px; line-height: 2.15; margin: 0 0 9px; overflow-wrap: anywhere; }
  p b { font-weight: bold; }
  .sign { display: flex; justify-content: space-between; gap: 18px; margin-top: 44px; padding: 0 10px; }
  .col { min-width: 0; font-size: 18px; font-weight: bold; }
  .col div { margin-bottom: 16px; }
  .stamp { width: 130px; height: 90px; border: 1px dashed #bbb; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #999; font-weight: normal; margin-top: 10px; }
  .date-note { margin-top: 15px; font-size: 11px; color: #777; text-align: center; }
  @media (max-width: 540px) {
    body { padding: 8px 5px 18px; }
    .page { margin-top: 48px; padding: 15px 11px; }
    .side { font-size: 9px; }
    .side b { font-size: 13px; }
    .logo { font-size: 14px; min-height: 50px; }
    h1 { font-size: 20px; margin: 21px 0 16px; }
    .meta { gap: 7px 12px; font-size: 10px; }
    p { font-size: 12px; line-height: 2; }
    .sign { padding: 0 4px; gap: 8px; margin-top: 34px; }
    .col { font-size: 14px; }
    .stamp { width: 100px; height: 75px; }
  }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .print-btn { display: none !important; }
    .page { width: 100%; margin: 0; padding: 0; border: 0; }
  }
</style>
</head>
<body>
<button class="print-btn" type="button" onclick="window.print()">طباعة / حفظ PDF</button>
<main class="page">
  <header class="header">
    <div class="side"><b>أرض الجوال</b>متجر إلكتروني للجوالات والأجهزة الذكية</div>
    <div class="logo">أرض<br>الجوال</div>
    <div class="side"><b>ERD AL JAWAL</b>Mobile &amp; Smart Devices Store</div>
  </header>

  <h1>عقد بيع بالتقسيط</h1>

  <div class="meta">
    <span>اليوم: ${escapeHtml(weekday)}</span>
    <span>التاريخ: ${escapeHtml(formatContractDate(orderDateSafe))}</span>
    <span>رقم الطلب: ${escapeHtml(orderNumber)}</span>
  </div>

  <p>نعم أنا السيد:/ <b>${escapeHtml(customer.name || '—')}</b> برقم جوال:/ <b dir="ltr">${escapeHtml(customer.phone || '—')}</b> وعنوانه:/ <b>${escapeHtml(customer.address || '—')}</b></p>

  <p>أقر وأعترف وأنا في حالتي الشرعية وبكامل قواي العقلية بأنني في ذمتي للمؤسسة المدعوة:/ <b>أرض الجوال</b> مبلغ وقدره:/ <b>${money(remaining)}</b> (${money(remaining)}) ريال فقط.</p>

  <p>وذلك قيمة عن ما تبقى من ثمن جهاز/أجهزة:/ <b>${escapeHtml(products)}</b></p>

  <p>على أن يدفع المبلغ على أقساط شهرية متتالية ومستمرة بدون انقطاع بما فيها شهر رمضان والأعياد.</p>

  <p>قيمة الدفعة الشهرية:/ <b>${money(monthlyPayment)}</b> ريال فقط اعتبارًا من تاريخ:/ <b>${escapeHtml(formatContractDate(firstInstallmentDate))}</b></p>

  <p>نهاية المبلغ المذكور أعلاه، وأنني بسداد الأقساط في موعدها بدون تأخر عن أي قسط عن موعده المحدد فإني ملتزم التزامًا تامًا بسداد المبلغ المتبقي كاملًا دفعة واحدة.</p>

  <p>كما أنني أقر على نفسي بأنه لا يوجد التزامات مالية ولا كفالات غرامية وقد أذنت والله خير الشاهدين.</p>

  <div class="sign">
    <div class="col">
      <div>الإسم:/ ${escapeHtml(customer.name || '—')}</div>
      <div>التوقيع:/ ........................</div>
    </div>
    <div class="col">
      <div>الختم</div>
      <div class="stamp">مكان الختم</div>
    </div>
  </div>
  <div class="date-note">صدر هذا العقد إلكترونيًا من أرض الجوال بناءً على بيانات الطلب.</div>
</main>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
        'x-robots-tag': 'noindex, nofollow, noarchive',
        'referrer-policy': 'no-referrer',
        'content-disposition': 'inline'
      }
    });
  } catch (error) {
    console.error('Installment contract render failed:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('تعذر عرض عقد البيع بالتقسيط حاليًا.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
