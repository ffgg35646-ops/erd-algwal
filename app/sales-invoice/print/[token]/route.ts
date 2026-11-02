import { getDb } from '@/lib/mongodb';
import type { StoreOrder } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContactSettings = {
  _id: string;
  whatsappNumber?: string;
  whatsappNumberRemoved?: boolean;
};

type FooterSettings = {
  _id: string;
  vatNumber?: string;
  vatNumberRemoved?: boolean;
};

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
      saleInvoiceToken: token,
      source: 'website',
      installment: { $ne: true }
    });

    if (!order) {
      return new Response('الفاتورة غير موجودة.', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    const [contactSettings, footerSettings] = await Promise.all([
      db.collection<ContactSettings>('store_settings').findOne({ _id: 'contact' }),
      db.collection<FooterSettings>('store_settings').findOne({ _id: 'footer' })
    ]);

    const whatsappNumber = contactSettings?.whatsappNumberRemoved
      ? ''
      : (typeof contactSettings?.whatsappNumber === 'string' ? contactSettings.whatsappNumber : '');
    const vatNumber = footerSettings?.vatNumberRemoved
      ? ''
      : (typeof footerSettings?.vatNumber === 'string' ? footerSettings.vatNumber : '');

    const orderNumber = order.orderNumber || '#' + order._id.toString().slice(-6);
    const total = Math.max(0, Number(order.total) || 0);
    const customer = order.customer || { name: '', phone: '', address: '' };
    const createdAt = new Date(order.createdAt);
    const dateText = Number.isNaN(createdAt.getTime())
      ? '—'
      : createdAt.toLocaleString('ar-SA', {
          calendar: 'gregory',
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Riyadh'
        });
    const paymentMethod = order.paymentMethod === 'mada'
      ? 'مدى'
      : order.paymentMethod === 'visa'
        ? 'Visa'
        : 'غير محددة';
    const paymentStatus = order.paymentStatus === 'paid'
      ? 'مدفوع'
      : order.paymentStatus === 'failed'
        ? 'تعذر الدفع'
        : 'بانتظار تأكيد الدفع';

    const productRows = (order.items || []).map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const lineTotal = unitPrice * quantity;
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td class="product-name"><b>' + escapeHtml(item.name || 'منتج') + '</b>' +
          (item.color ? '<small>اللون: ' + escapeHtml(item.color) + '</small>' : '') +
          (item.storage ? '<small>مساحة التخزين: ' + escapeHtml(item.storage) + '</small>' : '') + '</td>' +
        '<td>' + money(unitPrice) + ' ر.س</td>' +
        '<td>' + quantity + '</td>' +
        '<td>' + money(lineTotal) + ' ر.س</td>' +
      '</tr>';
    }).join('');

    const html = [
      '<!doctype html>',
      '<html lang="ar" dir="rtl">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="robots" content="noindex,nofollow,noarchive">',
      '<title>فاتورة البيع ' + escapeHtml(orderNumber) + ' — أرض الجوال</title>',
      '<style>',
      '* { box-sizing: border-box; }',
      'body { margin: 0; padding: 16px 10px 28px; background: #f3f4f6; color: #20242b; font-family: Tahoma, "Segoe UI", Arial, sans-serif; font-size: 13px; }',
      '.print-btn { position: fixed; top: 12px; right: 12px; z-index: 2; border: 0; border-radius: 8px; padding: 9px 18px; background: #3f4a5c; color: #fff; font: inherit; cursor: pointer; box-shadow: 0 2px 6px #0002; }',
      '.invoice { width: min(760px, 100%); margin: 42px auto 0; overflow: hidden; border: 1px solid #d9dde3; border-radius: 14px; background: #fff; }',
      '.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px; background: #3f4a5c; color: #fff; }',
      '.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }',
      '.logo { display: flex; width: 78px; height: 68px; flex: none; align-items: center; justify-content: center; border-radius: 10px; background: #fff; color: #3f4a5c; font-size: 17px; font-weight: 800; line-height: 1.4; text-align: center; }',
      '.brand h1 { margin: 0 0 6px; font-size: 21px; }',
      '.brand p { margin: 3px 0; font-size: 12px; }',
      '.title { flex: none; text-align: left; }',
      '.title h2 { margin: 0 0 8px; font-size: 25px; }',
      '.title p { margin: 4px 0; font-size: 11px; }',
      '.content { padding: 16px; }',
      '.meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; margin-bottom: 14px; border: 1px solid #d9dde3; border-radius: 10px; padding: 10px 12px; }',
      '.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }',
      '.card { min-width: 0; border: 1px solid #d9dde3; border-radius: 10px; padding: 12px; }',
      '.card h3 { margin: 0 0 9px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }',
      '.field { display: flex; justify-content: space-between; gap: 8px; margin: 8px 0; font-size: 11px; }',
      '.field span { flex: none; color: #6b7280; }',
      '.field b { overflow-wrap: anywhere; text-align: left; }',
      'table { width: 100%; margin: 0 0 14px; border-collapse: collapse; }',
      'th { padding: 10px 5px; border: 1px solid #fff; background: #3f4a5c; color: #fff; font-size: 11px; text-align: center; }',
      'td { padding: 9px 5px; border: 1px solid #d9dde3; font-size: 11px; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }',
      '.product-name { min-width: 150px; text-align: right; }',
      '.product-name small { display: block; margin-top: 5px; color: #6b7280; }',
      '.totals { width: min(330px, 100%); margin-right: auto; border: 1px solid #d9dde3; border-radius: 10px; overflow: hidden; }',
      '.total-row { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }',
      '.total-row:last-child { border: 0; background: #3f4a5c; color: #fff; font-size: 14px; font-weight: 800; }',
      '.bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 15px; }',
      '.note { min-height: 100px; border: 1px solid #d9dde3; border-radius: 10px; padding: 12px; }',
      '.note h3 { margin: 0 0 8px; font-size: 13px; }',
      '.note p { margin: 0; color: #6b7280; font-size: 10px; line-height: 1.9; }',
      '.footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 10px; line-height: 1.8; text-align: center; }',
      '.footer b { color: #20242b; }',
      '@media (max-width: 560px) { body { padding: 8px 5px 18px; } .invoice { margin-top: 48px; } .head { gap: 6px; padding: 10px 8px; } .brand { gap: 7px; } .logo { width: 54px; height: 54px; font-size: 12px; } .brand h1 { font-size: 14px; } .brand p { font-size: 9px; } .title h2 { font-size: 18px; } .title p { font-size: 9px; } .content { padding: 8px; } .cards, .bottom { gap: 6px; } .card { padding: 8px 7px; } .card h3 { font-size: 11px; } .field { gap: 4px; font-size: 9px; } th { padding: 7px 2px; font-size: 9px; } td { padding: 6px 2px; font-size: 9px; } .product-name { min-width: 90px; } .totals { width: 100%; } .total-row { padding: 8px; font-size: 10px; } .note { min-height: 90px; padding: 8px; } .note h3 { font-size: 11px; } .note p { font-size: 9px; } }',
      '@page { size: A4; margin: 10mm; }',
      '@media print { body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .print-btn { display: none !important; } .invoice { width: 100%; margin: 0; border-radius: 0; } }',
      '</style>',
      '</head>',
      '<body>',
      '<button class="print-btn" type="button" onclick="window.print()">طباعة / حفظ PDF</button>',
      '<main class="invoice">',
      '<header class="head">',
      '<div class="brand"><div class="logo">أرض<br>الجوال</div><div><h1>أرض الجوال</h1><p>متجر الجوالات والأجهزة الذكية</p><p>ERD AL JAWAL — Mobile &amp; Smart Devices Store</p></div></div>',
      '<div class="title"><h2>فاتورة بيع</h2><p>رقم الفاتورة: ' + escapeHtml(orderNumber) + '</p><p>فاتورة نقدية / شراء عادي</p></div>',
      '</header>',
      '<section class="content">',
      '<div class="meta"><span>تاريخ الفاتورة: ' + escapeHtml(dateText) + '</span><span>حالة الدفع: ' + escapeHtml(paymentStatus) + '</span></div>',
      '<div class="cards">',
      '<section class="card"><h3>بيانات العميل</h3><div class="field"><span>الاسم</span><b>' + escapeHtml(customer.name || '—') + '</b></div><div class="field"><span>رقم الجوال</span><b dir="ltr">' + escapeHtml(customer.phone || '—') + '</b></div><div class="field"><span>العنوان</span><b>' + escapeHtml(customer.address || '—') + '</b></div></section>',
      '<section class="card"><h3>بيانات الفاتورة</h3><div class="field"><span>رقم الطلب</span><b>' + escapeHtml(orderNumber) + '</b></div><div class="field"><span>طريقة الدفع</span><b>' + escapeHtml(paymentMethod) + '</b></div><div class="field"><span>العملة</span><b>الريال السعودي (SAR)</b></div></section>',
      '</div>',
      '<table><thead><tr><th style="width:7%">م</th><th>المنتج</th><th style="width:19%">سعر الوحدة</th><th style="width:10%">الكمية</th><th style="width:20%">الإجمالي</th></tr></thead><tbody>' +
        (productRows || '<tr><td colspan="5">لا توجد منتجات مسجلة</td></tr>') +
      '</tbody></table>',
      '<div class="totals"><div class="total-row"><span>عدد المنتجات</span><b>' + (order.items || []).reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0) + '</b></div><div class="total-row"><span>إجمالي الفاتورة</span><b>' + money(total) + ' ر.س</b></div></div>',
      '<div class="bottom"><section class="note"><h3>ملاحظات</h3><p>' + escapeHtml(order.notes || 'شكرًا لتسوقكم من أرض الجوال. نرجو الاحتفاظ بالفاتورة للرجوع إليها عند الحاجة.') + '</p></section><section class="note"><h3>بيانات المتجر</h3><p>أرض الجوال — متجر الجوالات والأجهزة الذكية<br>' +
        (vatNumber ? 'الرقم الضريبي: ' + escapeHtml(vatNumber) + '<br>' : '') +
        (whatsappNumber ? 'واتساب المتجر: ' + escapeHtml(whatsappNumber) : '') +
      '</p></section></div>',
      '<div class="footer"><b>أرض الجوال — شكرًا لثقتكم</b><br>هذا المستند صادر إلكترونيًا من نظام المتجر.</div>',
      '</section>',
      '</main>',
      '</body>',
      '</html>'
    ].join('\n');

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
    console.error('Sales invoice render failed:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('تعذر عرض فاتورة البيع حاليًا.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
