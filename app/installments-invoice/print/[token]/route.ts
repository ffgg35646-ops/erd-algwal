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

function formatDate(date: Date) {
  const parts = getDateParts(date);
  return String(parts.day).padStart(2, '0') + '/' +
    String(parts.month).padStart(2, '0') + '/' + parts.year;
}

function formatScheduleDate(date: Date) {
  return String(date.getUTCDate()).padStart(2, '0') + '/' +
    String(date.getUTCMonth() + 1).padStart(2, '0') + '/' + date.getUTCFullYear();
}

function getInstallmentDate(orderDate: Date, installmentIndex: number) {
  const parts = getDateParts(orderDate);
  const firstMonthIndex = parts.month % 12;
  const absoluteMonth = firstMonthIndex + installmentIndex;
  const year = parts.year + Math.floor(absoluteMonth / 12);
  const monthIndex = absoluteMonth % 12;
  // The invoice sample uses the 28th of each month as the installment due date.
  return new Date(Date.UTC(year, monthIndex, 28));
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

    const [contactSettings, footerSettings] = await Promise.all([
      db.collection<ContactSettings>('store_settings').findOne({ _id: 'contact' }),
      db.collection<FooterSettings>('store_settings').findOne({ _id: 'footer' })
    ]);

    const whatsappNumber = contactSettings?.whatsappNumberRemoved
      ? ''
      : (typeof contactSettings?.whatsappNumber === 'string'
          ? contactSettings.whatsappNumber
          : '201090466376');
    const vatNumber = footerSettings?.vatNumberRemoved
      ? ''
      : (typeof footerSettings?.vatNumber === 'string'
          ? footerSettings.vatNumber
          : '4353454564');

    const orderNumber = order.orderNumber || '#' + order._id.toString().slice(-6);
    const total = Math.max(0, Number(order.total) || 0);
    const totalCents = Math.round(total * 100);
    const downPayment = Math.min(total, Math.max(0, Number(order.installmentDownPayment) || 0));
    const downPaymentCents = Math.round(downPayment * 100);
    const remainingCents = Math.max(0, totalCents - downPaymentCents);
    const remaining = remainingCents / 100;
    const months = Math.min(24, Math.max(1, Math.floor(Number(order.installmentMonths) || 1)));
    const baseInstallmentCents = Math.floor(remainingCents / months);
    const customer = order.customer || { name: '', phone: '', address: '' };
    const createdAt = new Date(order.createdAt);
    const orderDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
    const dateText = formatDate(orderDate);
    const shipmentNumber = (order as StoreOrder & { shipmentNumber?: string }).shipmentNumber || '—';
    const paymentStatus = order.paymentStatus === 'paid'
      ? 'مدفوع'
      : order.paymentStatus === 'failed'
        ? 'تعذر الدفع'
        : 'بانتظار تأكيد الدفع';

    const productRows = (order.items || []).map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const itemTotal = unitPrice * quantity;
      const details = [
        item.color ? '<span class="tag">اللون: ' + escapeHtml(item.color) + '</span>' : '',
        item.storage ? '<span class="tag">التخزين: ' + escapeHtml(item.storage) + '</span>' : ''
      ].join('');
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td class="name"><b>' + escapeHtml(item.name || 'منتج') + '</b>' + details + '</td>' +
        '<td>' + money(unitPrice) + '</td>' +
        '<td>' + quantity + '</td>' +
        '<td>' + money(itemTotal) + '</td>' +
      '</tr>';
    }).join('');

    const installments = Array.from({ length: months }, (_, index) => {
      const amountCents = index === months - 1
        ? remainingCents - (baseInstallmentCents * (months - 1))
        : baseInstallmentCents;
      return {
        number: index + 1,
        amount: amountCents / 100,
        date: formatScheduleDate(getInstallmentDate(orderDate, index))
      };
    });
    const splitAt = Math.ceil(installments.length / 2);

    function installmentTable(rows: typeof installments) {
      return '<table><thead><tr><th>#</th><th>الدفعة</th><th>تاريخ الاستحقاق</th></tr></thead><tbody>' +
        rows.map((item) => '<tr><td>' + item.number + '</td><td>' +
          money(item.amount) + '</td><td dir="ltr">' + item.date + '</td></tr>').join('') +
        '</tbody></table>';
    }

    const firstSchedule = installmentTable(installments.slice(0, splitAt));
    const secondSchedule = installments.length > splitAt
      ? installmentTable(installments.slice(splitAt))
      : '<div class="empty-schedule"></div>';

    const html = [
      '<!doctype html>',
      '<html lang="ar" dir="rtl">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="robots" content="noindex,nofollow,noarchive">',
      '<title>فاتورة الأقساط ' + escapeHtml(orderNumber) + ' — أرض الجوال</title>',
      '<style>',
      '* { box-sizing: border-box; }',
      'body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; margin: 0; padding: 8px 10px 24px; background: #fff; color: #111; font-size: 12px; }',
      '.print-btn { position: fixed; top: 12px; right: 12px; z-index: 2; background: #3f4a5c; color: #fff; border: 0; border-radius: 8px; padding: 8px 18px; cursor: pointer; font-size: 13px; }',
      '.page { width: min(576px, 100%); margin: 42px auto 0; padding: 18px 0; }',
      '.header { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid #888; }',
      '.header .side { width: 36%; text-align: center; font-size: 10px; line-height: 1.6; }',
      '.header .side b { font-size: 15px; display: block; }',
      '.header .logo { width: 24%; min-height: 54px; display: flex; align-items: center; justify-content: center; text-align: center; color: #3f4a5c; border: 1px solid #9ca3af; padding: 8px 5px; font-size: 17px; font-weight: 800; line-height: 1.3; }',
      '.dateno { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 14px 0 10px; }',
      '.dateno .date { background: #777; color: #fff; font-weight: bold; padding: 3px 24px; font-size: 13px; }',
      '.dateno .no { color: #c00; font-weight: bold; font-style: italic; font-size: 13px; direction: ltr; }',
      '.welcome { display: flex; border: 1px solid #333; border-radius: 14px; overflow: hidden; margin-bottom: 8px; }',
      '.welcome > div { flex: 1; min-width: 0; padding: 9px 11px; font-size: 10px; line-height: 2; font-weight: bold; }',
      '.welcome .en { direction: ltr; text-align: left; border-right: 1px solid #333; }',
      '.welcome .ar { text-align: right; }',
      'table { width: 100%; border-collapse: collapse; }',
      'th { background: #1a56c4; color: #fff; padding: 6px 4px; font-size: 10px; border: 1px solid #fff; }',
      'td { border: 1px solid #aaa; padding: 6px 4px; text-align: center; font-size: 10px; color: #333; overflow-wrap: anywhere; }',
      '.cust { margin-bottom: 14px; }',
      'h3 { text-align: center; font-size: 14px; margin: 0 0 6px; }',
      '.tag { display: inline-block; background: #f1f3f6; border-radius: 10px; padding: 1px 7px; font-size: 9px; color: #666; margin: 4px 3px 0 0; }',
      'td.name { text-align: right; }',
      '.tot td { text-align: right; font-weight: bold; border-top: 1px solid #aaa; }',
      '.tot td.val { text-align: left; width: 25%; white-space: nowrap; }',
      '.info { display: flex; border: 1px solid #333; border-radius: 14px; overflow: hidden; margin: 5px 0 8px; min-height: 112px; }',
      '.info > div { padding: 9px; font-size: 9px; line-height: 2.1; font-weight: bold; }',
      '.info .stamp { width: 23%; display: flex; align-items: center; justify-content: center; border-left: 1px solid #333; color: #999; font-weight: normal; text-align: center; }',
      '.info .mid { width: 38%; border-left: 1px solid #333; display: flex; flex-direction: column; justify-content: center; }',
      '.info .terms { flex: 1; }',
      '.inst { display: flex; gap: 0; align-items: flex-start; }',
      '.inst > table { width: 50%; }',
      '.inst th { font-size: 9px; padding: 5px 2px; }',
      '.inst td { padding: 4px 2px; font-size: 9px; }',
      '.empty-schedule { width: 50%; }',
      '.remain { display: flex; background: #1a56c4; color: #fff; font-size: 15px; font-weight: bold; padding: 8px 10px; border: 1px solid #fff; outline: 1px solid #1a56c4; margin-top: 4px; }',
      '.remain span:first-child { width: 22%; text-align: center; border-left: 1px solid #fff; }',
      '.remain span:last-child { padding-right: 12px; }',
      '.status { margin-top: 7px; text-align: center; color: #555; font-size: 9px; }',
      '@media (max-width: 420px) { body { padding: 5px; } .page { padding-top: 10px; } .header .side { font-size: 8px; } .header .side b { font-size: 12px; } .header .logo { font-size: 13px; min-height: 45px; } .welcome > div { padding: 7px 6px; font-size: 8px; } .dateno .date { padding-inline: 12px; font-size: 11px; } .info > div { padding: 6px; font-size: 8px; } td { font-size: 9px; padding: 5px 2px; } }',
      '@page { size: A4; margin: 10mm; }',
      '@media print { body { padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .print-btn { display: none !important; } .page { width: 100%; margin: 0 auto; padding: 0; } }',
      '</style>',
      '</head>',
      '<body>',
      '<button class="print-btn" type="button" onclick="window.print()">طباعة / حفظ PDF</button>',
      '<main class="page">',
      '<header class="header">',
      '<div class="side"><b>أرض الجوال</b>متجر إلكتروني للجوالات والأجهزة الذكية</div>',
      '<div class="logo">أرض<br>الجوال</div>',
      '<div class="side"><b>ERD AL JAWAL</b>Mobile &amp; Smart Devices Store</div>',
      '</header>',
      '<div class="dateno"><div class="no">No. ' + escapeHtml(orderNumber) + '</div><div class="date">' + escapeHtml(dateText) + '</div></div>',
      '<section class="welcome">',
      '<div class="ar">عميلنا العزيز،<br>شكرًا لتسوقكم من أرض الجوال.<br>لقد تم إنشاء طلبكم بنجاح.<br>فيما يلي ملخص الطلب.</div>',
      '<div class="en">Dear Customer,<br>Thank you for shopping with ERD AL JAWAL.<br>Your order has been placed.<br>Below is the summary of the order.</div>',
      '</section>',
      '<table class="cust"><thead><tr><th>اسم العميل</th><th>رقم الجوال</th><th>العنوان</th></tr></thead><tbody><tr><td>' +
        escapeHtml(customer.name || '—') + '</td><td dir="ltr">' + escapeHtml(customer.phone || '—') + '</td><td>' +
        escapeHtml(customer.address || '—') + '</td></tr></tbody></table>',
      '<h3>تفاصيل الفاتورة</h3>',
      '<table><thead><tr><th style="width:6%">#</th><th>اسم الجهاز</th><th style="width:18%">السعر</th><th style="width:10%">الكمية</th><th style="width:19%">الإجمالي</th></tr></thead><tbody>' +
        (productRows || '<tr><td colspan="5">لا توجد منتجات مسجلة</td></tr>') +
      '</tbody></table>',
      '<table class="tot"><tbody><tr><td>الإجمالي</td><td class="val">' + money(total) + ' ر.س</td></tr>' +
      '<tr><td>الدفعة المقدمة</td><td class="val">' + money(downPayment) + ' ر.س</td></tr></tbody></table>',
      '<section class="info">',
      '<div class="terms">يتم اعتماد الطلب وتجهيزه للشحن بعد تأكيد الدفعة المقدمة<br>التوصيل حسب سياسة المتجر ومنطقة العميل<br>يبدأ تجهيز الطلب بعد تأكيد الدفعة المقدمة</div>',
      '<div class="mid"><span>العرض شامل الهدايا</span><span>الرقم الضريبي: ' + escapeHtml(vatNumber || '—') + '</span></div>',
      '<div class="stamp">مكان الختم<br>/ الشعار</div>',
      '</section>',
      '<div class="inst">' + firstSchedule + secondSchedule + '</div>',
      '<div class="remain"><span>المتبقي</span><span>' + money(remaining) + ' ر.س</span></div>',
      '<div class="status">حالة الدفع: ' + escapeHtml(paymentStatus) +
        (whatsappNumber ? ' | واتساب المتجر: ' + escapeHtml(whatsappNumber) : '') + '</div>',
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
    console.error('Installment invoice render failed:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('تعذر عرض فاتورة الأقساط حاليًا.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
