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
  }).format(Number.isFinite(value) ? value : 0) + ' ر.س';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    return new Response('الفاتورة غير موجودة.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  try {
    const db = await getDb();
    const order = await db.collection<StoreOrder>('orders').findOne({
      installmentInvoiceToken: token,
      source: 'website',
      installment: true
    });

    if (!order) {
      return new Response('الفاتورة غير موجودة.', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    const orderNumber = order.orderNumber || '#' + order._id.toString().slice(-6);
    const total = Math.max(0, Number(order.total) || 0);
    const downPayment = Math.min(total, Math.max(0, Number(order.installmentDownPayment) || 0));
    const months = Math.max(1, Math.floor(Number(order.installmentMonths) || 1));
    const monthlyPayment = (total - downPayment) / months;
    const customer = order.customer || { name: '', phone: '', address: '' };
    const createdAt = new Date(order.createdAt);
    const dateText = Number.isNaN(createdAt.getTime())
      ? '—'
      : createdAt.toLocaleString('en-GB', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Riyadh'
        });
    const shipmentNumber = (order as StoreOrder & { shipmentNumber?: string }).shipmentNumber || '—';
    const rows = (order.items || []).map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const itemTotal = unitPrice * quantity;
      const details = [
        item.color ? '<span class="tag">اللون: ' + escapeHtml(item.color) + '</span>' : ''
      ].filter(Boolean).join('');
      return `<tr>
        <td><div class="image-placeholder">أرض الجوال</div></td>
        <td class="product-cell">
          <b class="product-name">${escapeHtml(item.name || 'منتج')}</b>
          ${details}
        </td>
        <td>${quantity}</td>
        <td dir="ltr">${money(unitPrice)}</td>
        <td dir="ltr">${money(itemTotal)}</td>
      </tr>`;
    }).join('');
    const paymentStatus = order.paymentStatus === 'paid'
      ? 'مدفوع'
      : order.paymentStatus === 'failed'
        ? 'تعذر الدفع'
        : 'بانتظار تأكيد الدفع';
    const paymentNowLabel = order.paymentStatus === 'paid' ? 'المدفوع الآن' : 'الدفعة الأولى';

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>فاتورة تقسيط ${escapeHtml(orderNumber)} — أرض الجوال</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; margin: 0; padding: 16px 10px 28px; background: #f3f4f6; color: #1f2937; font-size: 13px; }
  .print-btn { position: fixed; top: 12px; right: 12px; z-index: 2; background: #3f4a5c; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; cursor: pointer; font: inherit; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
  .invoice { width: min(718px, 100%); margin: 42px auto 0; border: 1px solid #d9dde3; border-radius: 14px; overflow: hidden; background: #fff; }
  .head { background: #3f4a5c; color: #fff; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo { width: 82px; height: 72px; flex: none; background: #fff; border-radius: 10px; color: #3f4a5c; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; text-align: center; line-height: 1.4; }
  .brand h1 { margin: 0 0 6px; font-size: 20px; }
  .brand p { margin: 3px 0; font-size: 12px; }
  .title { text-align: left; direction: ltr; flex: none; }
  .title h2 { margin: 0 0 6px; font-size: 27px; direction: rtl; }
  .title p { margin: 3px 0; font-size: 11px; }
  .body { padding: 14px; }
  .row { display: flex; gap: 12px; margin-bottom: 14px; }
  .card { min-width: 0; flex: 1; border: 1px solid #d9dde3; border-radius: 12px; padding: 12px 14px; }
  .card h3 { margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  .kv { display: flex; justify-content: space-between; gap: 10px; margin: 9px 0; font-size: 12px; }
  .kv span { color: #6b7280; flex: none; }
  .kv b { color: #111; text-align: left; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #3f4a5c; color: #fff; padding: 9px 5px; font-size: 11px; text-align: center; border-left: 1px solid #5a6578; }
  th:first-child { text-align: center; }
  td { border: 1px solid #e5e7eb; padding: 8px 5px; text-align: center; font-size: 11px; vertical-align: middle; overflow-wrap: anywhere; }
  .product-cell { text-align: right; min-width: 130px; }
  .product-name { display: block; font-size: 12px; }
  .image-placeholder { width: 36px; height: 44px; background: #e5e7eb; border-radius: 4px; margin: auto; display: flex; align-items: center; justify-content: center; color: #777; font-size: 7px; text-align: center; }
  .tag { display: inline-block; background: #f1f3f6; border-radius: 10px; padding: 3px 8px; font-size: 10px; margin: 4px 0 0 5px; }
  .inst { border: 1px dashed #c4c9d2; border-radius: 12px; padding: 10px; display: flex; gap: 10px; margin-bottom: 14px; }
  .inst div { min-width: 0; flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafbfc; text-align: center; padding: 10px 4px; }
  .inst small { display: block; color: #6b7280; font-size: 11px; margin-bottom: 6px; }
  .inst b { font-size: 12px; }
  .bottom { display: flex; gap: 12px; }
  .notes { min-width: 0; flex: 1; border: 1px solid #d9dde3; border-radius: 12px; padding: 14px; min-height: 130px; }
  .notes h3 { margin: 0 0 10px; font-size: 15px; }
  .notes p { margin: 0; color: #6b7280; font-size: 11px; line-height: 1.9; }
  .totals { min-width: 0; flex: 1; border: 1px solid #d9dde3; border-radius: 12px; overflow: hidden; }
  .totals .line { display: flex; justify-content: space-between; gap: 10px; padding: 10px 11px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  .totals .line span { color: #6b7280; }
  .totals .grand { background: #3f4a5c; color: #fff; font-weight: bold; border: 0; }
  .totals .grand span { color: #fff; }
  .foot { text-align: center; border-top: 1px solid #e5e7eb; margin-top: 16px; padding-top: 12px; font-size: 11px; color: #6b7280; }
  .foot b { color: #111; }
  @media (max-width: 540px) {
    body { padding: 8px 5px 18px; font-size: 12px; }
    .invoice { margin-top: 48px; }
    .head { padding: 10px 8px; gap: 6px; }
    .brand { gap: 7px; }
    .logo { width: 54px; height: 54px; font-size: 12px; }
    .brand h1 { font-size: 14px; }
    .brand p { font-size: 9px; }
    .title h2 { font-size: 20px; }
    .title p { font-size: 9px; }
    .body { padding: 8px; }
    .row { gap: 7px; }
    .card { padding: 8px 7px; }
    .card h3 { font-size: 12px; }
    .kv { font-size: 10px; gap: 4px; }
    th { font-size: 9px; padding: 7px 2px; }
    td { font-size: 9px; padding: 6px 2px; }
    .product-name { font-size: 10px; }
    .inst { gap: 5px; padding: 6px; }
    .inst small { font-size: 9px; }
    .inst b { font-size: 10px; }
    .bottom { gap: 6px; }
    .totals .line { padding: 8px 6px; font-size: 9px; }
    .notes { padding: 9px; min-height: 115px; }
    .notes h3 { font-size: 12px; }
    .notes p { font-size: 9px; }
  }
  @page { size: A4; margin: 10mm; }
  @media print {
    body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .print-btn { display: none !important; }
    .invoice { width: 100%; margin: 0; border-radius: 0; }
  }
</style>
</head>
<body>
<button class="print-btn" type="button" onclick="window.print()">طباعة / حفظ PDF</button>
<main class="invoice">
  <header class="head">
    <div class="brand">
      <div class="logo">أرض<br>الجوال</div>
      <div>
        <h1>أرض الجوال</h1>
        <p>متجر الجوالات والأجهزة الذكية</p>
      </div>
    </div>
    <div class="title">
      <h2>فاتورة تقسيط</h2>
      <p>رقم الطلب: ${escapeHtml(orderNumber)}</p>
      <p dir="ltr">${escapeHtml(dateText)}</p>
    </div>
  </header>
  <div class="body">
    <div class="row">
      <section class="card">
        <h3>بيانات العميل</h3>
        <div class="kv"><span>الاسم</span><b>${escapeHtml(customer.name || '—')}</b></div>
        <div class="kv"><span>الجوال</span><b dir="ltr">${escapeHtml(customer.phone || '—')}</b></div>
        <div class="kv"><span>العنوان</span><b>${escapeHtml(customer.address || '—')}</b></div>
      </section>
      <section class="card">
        <h3>بيانات الطلب</h3>
        <div class="kv"><span>رقم الطلب</span><b>${escapeHtml(orderNumber)}</b></div>
        <div class="kv"><span>رقم الشحنة</span><b>${escapeHtml(shipmentNumber)}</b></div>
        <div class="kv"><span>طريقة الدفع</span><b>تقسيط</b></div>
      </section>
    </div>
    <table>
      <thead><tr><th>الصورة</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">لا توجد منتجات مسجلة</td></tr>'}</tbody>
    </table>
    <section class="inst">
      <div><small>الدفعة الأولى</small><b>${money(downPayment)}</b></div>
      <div><small>مدة التقسيط</small><b>${months} شهر</b></div>
      <div><small>القسط الشهري</small><b>${money(monthlyPayment)}</b></div>
    </section>
    <div class="bottom">
      <section class="totals">
        <div class="line"><span>قيمة المنتجات</span><b>${money(total)}</b></div>
        <div class="line"><span>الشحن</span><b>${money(0)}</b></div>
        <div class="line"><span>${paymentNowLabel}</span><b>${money(downPayment)}</b></div>
        <div class="line grand"><span>الإجمالي</span><b>${money(total)}</b></div>
      </section>
      <section class="notes">
        <h3>ملاحظات</h3>
        <p>تم إصدار هذه الفاتورة إلكترونيًا. يرجى الاحتفاظ بنسخة منها لاستخدامها عند الحاجة.</p>
        <p style="margin-top:8px">حالة الدفع: ${escapeHtml(paymentStatus)}</p>
      </section>
    </div>
    <footer class="foot">
      <b>أرض الجوال — متجر الجوالات والأجهزة الذكية</b><br>
      شكرًا لاختياركم أرض الجوال
    </footer>
  </div>
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
    console.error('Installment invoice render failed:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('تعذر عرض فاتورة التقسيط حاليًا.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
