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

function statusLabel(status: StoreOrder['status']) {
  const labels: Record<string, string> = {
    new: 'جديد',
    confirmed: 'تم التأكيد',
    preparing: 'قيد التجهيز',
    shipped: 'تم الشحن',
    completed: 'مكتمل',
    cancelled: 'ملغي'
  };
  return labels[status] || 'غير محدد';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'private, no-store, max-age=0',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'referrer-policy': 'no-referrer'
  };

  if (!/^[a-f0-9]{48}$/i.test(token)) {
    return new Response('الطلب غير موجود.', { status: 404, headers });
  }

  try {
    const db = await getDb();
    const order = await db.collection<StoreOrder>('orders').findOne({
      adminOrderToken: token,
      source: 'website'
    });

    if (!order) return new Response('الطلب غير موجود أو أن الرابط غير صالح.', { status: 404, headers });

    const customer = order.customer || { name: '', phone: '', address: '' };
    const orderNumber = order.orderNumber || '#' + order._id.toString().slice(-6);
    const createdAt = new Date(order.createdAt);
    const dateText = Number.isNaN(createdAt.getTime())
      ? '—'
      : new Intl.DateTimeFormat('ar-SA', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Riyadh'
        }).format(createdAt);

    const productRows = (order.items || []).map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const total = unitPrice * quantity;
      const details = [
        item.color ? '<span class="muted">اللون: ' + escapeHtml(item.color) + '</span>' : '',
        item.storage ? '<span class="muted">مساحة التخزين: ' + escapeHtml(item.storage) + '</span>' : ''
      ].filter(Boolean).join('');
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td><b>' + escapeHtml(item.name || 'منتج') + '</b>' + (details ? '<div>' + details + '</div>' : '') + '</td>' +
        '<td>' + quantity + '</td>' +
        '<td>' + money(unitPrice) + ' ر.س</td>' +
        '<td><b>' + money(total) + ' ر.س</b></td>' +
      '</tr>';
    }).join('');

    const paymentMethod = order.paymentMethod === 'visa'
      ? 'Visa'
      : order.paymentMethod === 'mada'
        ? 'مدى'
        : 'لم يتم الاختيار';
    const paymentStatus = order.paymentStatus === 'paid'
      ? 'مدفوع'
      : order.paymentStatus === 'failed'
        ? 'فشل الدفع'
        : order.paymentStatus === 'not_recorded'
          ? 'غير مسجل'
          : 'بانتظار تأكيد الدفع';

    const visaDetails = order.paymentMethod === 'visa'
      ? '<div class="details-grid">' +
          '<div class="detail"><span>اسم حامل البطاقة</span><b>' + escapeHtml(order.cardholderName || '—') + '</b></div>' +
          '<div class="detail"><span>آخر 4 أرقام من البطاقة</span><b dir="ltr">•••• ' + escapeHtml(order.cardLast4 || '—') + '</b></div>' +
          '<div class="detail"><span>تاريخ انتهاء البطاقة</span><b dir="ltr">' +
            escapeHtml(order.expiryMonth && order.expiryYear ? order.expiryMonth + '/' + order.expiryYear : '—') +
          '</b></div>' +
        '</div>'
      : '<p class="muted">لا توجد بيانات بطاقة Visa لهذا الطلب.</p>';

    const documents = order.installment
      ? [
          order.installmentInvoiceToken
            ? { title: 'فاتورة الأقساط', description: 'عرض وطباعة فاتورة الأقساط وجدول الدفعات', href: '/installments-invoice/print/' + encodeURIComponent(order.installmentInvoiceToken) }
            : null,
          order.installmentContractToken
            ? { title: 'عقد البيع بالتقسيط', description: 'عرض عقد البيع الخاص بهذا الطلب', href: '/installments-contract/print/' + encodeURIComponent(order.installmentContractToken) }
            : null
        ].filter((item): item is { title: string; description: string; href: string } => Boolean(item))
      : [
          order.saleInvoiceToken
            ? { title: 'فاتورة البيع', description: 'عرض وطباعة فاتورة البيع النقدي', href: '/sales-invoice/print/' + encodeURIComponent(order.saleInvoiceToken) }
            : null,
          order.receiptToken
            ? { title: 'سند القبض', description: 'عرض وطباعة سند استلام المبلغ', href: '/receipt/print/' + encodeURIComponent(order.receiptToken) }
            : null
        ].filter((item): item is { title: string; description: string; href: string } => Boolean(item));

    const documentHtml = documents.length
      ? documents.map((document) =>
          '<a class="document" href="' + document.href + '">' +
            '<span class="document-icon">↗</span>' +
            '<span><b>' + document.title + '</b><small>' + document.description + '</small></span>' +
          '</a>'
        ).join('')
      : '<p class="muted">لا توجد مستندات مرتبطة بهذا الطلب.</p>';

    const installmentHtml = order.installment
      ? '<div class="detail"><span>نوع البيع</span><b>تقسيط</b></div>' +
        '<div class="detail"><span>الدفعة المقدمة</span><b>' + money(Number(order.installmentDownPayment) || 0) + ' ر.س</b></div>' +
        '<div class="detail"><span>مدة التقسيط</span><b>' + Math.max(0, Number(order.installmentMonths) || 0) + ' شهر</b></div>' +
        '<div class="detail"><span>المبلغ المتبقي</span><b>' + money(Math.max(0, Number(order.total || 0) - Number(order.installmentDownPayment || 0))) + ' ر.س</b></div>'
      : '<div class="detail"><span>نوع البيع</span><b>نقدي</b></div>';

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>تفاصيل الطلب ${escapeHtml(orderNumber)} — أرض الجوال</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 14px 44px; background: #f4f5f7; color: #202124; font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  .page { width: min(900px, 100%); margin: 0 auto; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .brand { font-size: 20px; font-weight: 800; color: #3c3528; }
  .brand small { display: block; margin-top: 5px; color: #858585; font-size: 11px; font-weight: 400; }
  .order-number { direction: ltr; color: #7b5b24; font-size: 16px; font-weight: 800; }
  .card { margin-bottom: 14px; padding: 20px; background: #fff; border: 1px solid #e7e7e7; border-radius: 14px; box-shadow: 0 4px 18px rgba(0,0,0,.035); }
  .heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 0 0 16px; font-size: 17px; }
  .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 6px 12px; background: #f3eee4; color: #755720; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .muted { color: #7a7d81; font-size: 12px; line-height: 1.8; }
  .details-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
  .detail { min-width: 0; padding: 12px 14px; border: 1px solid #ededed; border-radius: 10px; background: #fcfcfc; }
  .detail span { display: block; color: #777; font-size: 12px; margin-bottom: 7px; }
  .detail b { display: block; font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
  .wide { grid-column: 1 / -1; }
  .table-wrap { width: 100%; overflow-x: auto; }
  table { width: 100%; min-width: 560px; border-collapse: collapse; }
  th, td { padding: 12px 10px; border-bottom: 1px solid #ededed; text-align: right; font-size: 13px; line-height: 1.7; }
  th { background: #faf9f6; color: #5b5142; font-size: 12px; }
  td .muted { display: inline-block; margin-top: 3px; }
  .total { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 16px; padding-top: 15px; border-top: 1px solid #e9e9e9; font-weight: 800; }
  .total strong { color: #76571f; font-size: 20px; direction: ltr; }
  .documents { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
  .document { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 15px; color: inherit; text-decoration: none; border: 1px solid #e8e2d6; border-radius: 12px; background: #fffdf9; transition: border-color .15s, transform .15s; }
  .document:hover { border-color: #bca16e; transform: translateY(-1px); }
  .document-icon { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border-radius: 10px; background: #f1eadc; color: #78591f; font-size: 20px; font-weight: 800; }
  .document b { display: block; font-size: 14px; margin-bottom: 5px; }
  .document small { display: block; color: #777; font-size: 11px; line-height: 1.6; }
  .note { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.9; font-size: 13px; }
  @media (max-width: 620px) {
    body { padding: 14px 9px 28px; }
    .card { padding: 15px 12px; border-radius: 11px; }
    .brand { font-size: 17px; }
    .order-number { font-size: 13px; }
    .heading { font-size: 15px; }
    .details-grid, .documents { grid-template-columns: 1fr; }
    .detail b { font-size: 13px; }
    .document { padding: 12px; }
    .total strong { font-size: 17px; }
  }
  @media print {
    body { padding: 0; background: #fff; }
    .card { break-inside: avoid; box-shadow: none; }
    .document { color: #111; }
  }
</style>
</head>
<body>
<main class="page">
  <header class="top">
    <div class="brand">أرض الجوال<small>تفاصيل الطلب ومستنداته</small></div>
    <div class="order-number">${escapeHtml(orderNumber)}</div>
  </header>

  <section class="card">
    <h1 class="heading"><span>ملخص الطلب</span><span class="badge">${escapeHtml(statusLabel(order.status))}</span></h1>
    <div class="details-grid">
      <div class="detail"><span>تاريخ الطلب</span><b>${escapeHtml(dateText)}</b></div>
      ${installmentHtml}
      <div class="detail"><span>حالة الدفع</span><b>${escapeHtml(paymentStatus)}</b></div>
      <div class="detail"><span>طريقة الدفع</span><b>${escapeHtml(paymentMethod)}</b></div>
    </div>
  </section>

  <section class="card">
    <h2 class="heading">بيانات العميل والتوصيل</h2>
    <div class="details-grid">
      <div class="detail"><span>اسم العميل</span><b>${escapeHtml(customer.name || '—')}</b></div>
      <div class="detail"><span>رقم الجوال</span><b dir="ltr">${escapeHtml(customer.phone || '—')}</b></div>
      <div class="detail"><span>البريد الإلكتروني</span><b>${escapeHtml(customer.email || '—')}</b></div>
      <div class="detail"><span>رقم الهوية</span><b dir="ltr">${escapeHtml(customer.idNumber || '—')}</b></div>
      <div class="detail wide"><span>عنوان التوصيل</span><b>${escapeHtml(customer.address || '—')}</b></div>
    </div>
  </section>

  <section class="card">
    <h2 class="heading">المنتجات</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
        <tbody>${productRows || '<tr><td colspan="5">لا توجد منتجات مسجلة.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="total"><span>إجمالي الطلب</span><strong>${money(Number(order.total) || 0)} ر.س</strong></div>
  </section>

  <section class="card">
    <h2 class="heading">بيانات الدفع</h2>
    ${visaDetails}
    ${order.installment ? '<p class="muted">تم اختيار نظام التقسيط. تفاصيل الدفعة المقدمة والمدة والمبلغ المتبقي موضحة في ملخص الطلب، وجدول الدفعات داخل فاتورة الأقساط.</p>' : ''}
  </section>

  <section class="card">
    <h2 class="heading">مستندات الطلب</h2>
    <div class="documents">${documentHtml}</div>
  </section>

  ${order.notes ? '<section class="card"><h2 class="heading">ملاحظات الطلب</h2><div class="note">' + escapeHtml(order.notes) + '</div></section>' : ''}
</main>
</body>
</html>`;

    return new Response(html, { status: 200, headers });
  } catch (error) {
    console.error('Admin order page failed:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('تعذر تحميل تفاصيل الطلب حاليًا.', { status: 500, headers });
  }
}
