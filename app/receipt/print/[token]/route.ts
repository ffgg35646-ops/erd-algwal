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

function wordsUnder1000(value: number): string {
  const number = Math.max(0, Math.floor(value));
  if (number === 0) return 'صفر';

  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens: Record<number, string> = {
    10: 'عشرة',
    11: 'أحد عشر',
    12: 'اثنا عشر',
    13: 'ثلاثة عشر',
    14: 'أربعة عشر',
    15: 'خمسة عشر',
    16: 'ستة عشر',
    17: 'سبعة عشر',
    18: 'ثمانية عشر',
    19: 'تسعة عشر'
  };
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];
  const hundred = Math.floor(number / 100);
  const remainder = number % 100;

  if (hundred > 0) parts.push(hundreds[hundred]);
  if (remainder > 0) {
    if (remainder < 10) {
      parts.push(units[remainder]);
    } else if (remainder < 20) {
      parts.push(teens[remainder]);
    } else {
      const unit = remainder % 10;
      const ten = Math.floor(remainder / 10);
      parts.push(unit ? units[unit] + ' و ' + tens[ten] : tens[ten]);
    }
  }

  return parts.join(' و ');
}

function numberToArabicWords(value: number): string {
  const number = Math.max(0, Math.floor(value));
  if (number < 1000) return wordsUnder1000(number);

  const parts: string[] = [];
  const millions = Math.floor(number / 1_000_000);
  const thousands = Math.floor((number % 1_000_000) / 1000);
  const remainder = number % 1000;

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions <= 10) parts.push(wordsUnder1000(millions) + ' ملايين');
    else parts.push(wordsUnder1000(millions) + ' مليونًا');
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands <= 10) parts.push(wordsUnder1000(thousands) + ' آلاف');
    else parts.push(wordsUnder1000(thousands) + ' ألفًا');
  }

  if (remainder > 0) parts.push(wordsUnder1000(remainder));
  return parts.join(' و ');
}

function amountInArabicWords(value: number): string {
  const rounded = Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;
  const riyals = Math.floor(rounded);
  const halalas = Math.round((rounded - riyals) * 100);
  const riyalText = numberToArabicWords(riyals) + ' ريال سعودي';
  const halalaText = halalas > 0 ? ' و ' + numberToArabicWords(halalas) + ' هللة' : '';
  return 'فقط ' + riyalText + halalaText + ' لا غير';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    return new Response('المستند غير موجود.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  try {
    const db = await getDb();
    const order = await db.collection<StoreOrder>('orders').findOne({
      receiptToken: token,
      source: 'website',
      installment: { $ne: true }
    });

    if (!order) {
      return new Response('المستند غير موجود.', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    const total = Number.isFinite(Number(order.total)) ? Math.max(0, Number(order.total)) : 0;
    const totalText = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(total);
    const orderNumber = order.orderNumber || '#' + order._id.toString().slice(-6);
    const customerName = escapeHtml(order.customer?.name || '—');
    const customerPhone = escapeHtml(order.customer?.phone || '—');
    const customerAddress = escapeHtml(order.customer?.address || '—');
    const products = (order.items || []).map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      return escapeHtml(item.name || 'منتج') + ' × ' + quantity +
        (item.color ? ' — اللون: ' + escapeHtml(item.color) : '');
    }).join('، ') || '—';
    const createdAt = new Date(order.createdAt);
    const dateText = Number.isNaN(createdAt.getTime())
      ? '—'
      : createdAt.toLocaleString('ar-SA', {
          calendar: 'gregory',
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Riyadh'
        });
    const amountWords = escapeHtml(amountInArabicWords(total));
    const receiptDescription = 'قيمة شراء كاش للمنتجات: ' + products;

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>سند قبض ${escapeHtml(orderNumber)} — أرض الجوال</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 18px 12px 32px; background: #f4f4f4; color: #111; font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  .actions { width: min(720px, 100%); margin: 0 auto 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #555; font-size: 13px; }
  .print-button { border: 0; border-radius: 7px; background: #80601f; color: #fff; padding: 10px 16px; font: inherit; font-weight: 700; cursor: pointer; }
  .page { width: min(720px, 100%); margin: 0 auto; padding: 20px 0 0; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 0 20px 14px; border-bottom: 1px solid #888; }
  .side { width: 38%; text-align: center; font-size: 13px; line-height: 1.7; }
  .side b { display: block; margin-bottom: 4px; font-size: 19px; }
  .logo { width: 24%; min-height: 62px; display: flex; align-items: center; justify-content: center; border: 1px solid #999; padding: 8px 5px; text-align: center; color: #222; font-size: 19px; line-height: 1.35; font-weight: 800; }
  .meta { display: flex; justify-content: space-between; gap: 12px; padding: 10px 22px 0; color: #444; font-size: 12px; }
  .voucher { width: calc(100% - 48px); margin: 20px auto 0; border: 1px solid #888; min-height: 610px; padding-bottom: 28px; }
  .top { position: relative; height: 44px; }
  .no { position: absolute; left: 14px; top: 12px; color: #c00; font-weight: bold; direction: ltr; font-style: italic; }
  .title { position: absolute; left: 50%; transform: translateX(-50%); top: 0; background: #999; padding: 3px 36px; font-size: 18px; font-weight: bold; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; }
  td { border: 1px solid #333; padding: 10px 8px; font-size: 14px; text-align: center; line-height: 1.8; overflow-wrap: anywhere; }
  td.label { width: 25%; text-align: right; font-weight: bold; font-size: 15px; }
  td.cur { width: 15%; white-space: nowrap; }
  .description { text-align: right; }
  .sign { display: flex; justify-content: space-around; gap: 20px; margin-top: 46px; text-align: center; }
  .sign h3 { margin: 0 0 14px; font-size: 18px; }
  .stamp { width: 130px; height: 90px; display: flex; align-items: center; justify-content: center; margin: auto; border: 1px dashed #bbb; color: #999; font-size: 11px; }
  .thanks { margin-top: 28px; text-align: center; color: #666; font-size: 11px; }
  @media (max-width: 520px) {
    body { padding: 8px 5px 18px; }
    .header { padding-inline: 8px; gap: 5px; }
    .side { font-size: 10px; }
    .side b { font-size: 14px; }
    .logo { font-size: 14px; min-height: 52px; }
    .meta { padding-inline: 10px; font-size: 10px; }
    .voucher { width: calc(100% - 16px); margin-top: 14px; min-height: 560px; }
    .title { font-size: 15px; padding-inline: 18px; }
    .no { left: 7px; font-size: 11px; }
    td { padding: 7px 5px; font-size: 12px; }
    td.label { font-size: 12px; }
    .sign h3 { font-size: 15px; }
  }
  @page { size: A4; margin: 12mm; }
  @media print {
    body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .actions { display: none !important; }
    .page { width: 100%; margin: 0; padding: 0; }
    .voucher { width: 100%; margin: 16px auto 0; min-height: 610px; }
  }
</style>
</head>
<body>
  <div class="actions">
    <span>سند قبض للطلب ${escapeHtml(orderNumber)} — أرض الجوال</span>
    <button class="print-button" type="button" onclick="window.print()">طباعة / حفظ PDF</button>
  </div>
  <main class="page">
    <header class="header">
      <div class="side"><b>أرض الجوال</b>متجر الجوالات والأجهزة الذكية</div>
      <div class="logo">أرض<br>الجوال</div>
      <div class="side"><b>ERD AL JAWAL</b>Mobile &amp; Smart Devices Store</div>
    </header>
    <div class="meta">
      <span>تاريخ السند: ${escapeHtml(dateText)}</span>
      <span>نوع الشراء: كاش</span>
    </div>
    <section class="voucher">
      <div class="top">
        <div class="no">No. ${escapeHtml(orderNumber)}</div>
        <div class="title">سند قبض</div>
      </div>
      <table>
        <tbody>
          <tr>
            <td class="label">المبلغ:</td>
            <td>${totalText}</td>
            <td class="cur">ر.س</td>
          </tr>
          <tr><td class="label">استلمت من السيد:</td><td colspan="2">${customerName}</td></tr>
          <tr><td class="label">رقم الجوال:</td><td colspan="2" dir="ltr">${customerPhone}</td></tr>
          <tr><td class="label">العنوان:</td><td colspan="2">${customerAddress}</td></tr>
          <tr><td class="label">وذلك عن:</td><td colspan="2" class="description">${escapeHtml(receiptDescription)}</td></tr>
          <tr><td class="label">المبلغ بالحروف:</td><td colspan="2">${amountWords}</td></tr>
        </tbody>
      </table>
      <div class="sign">
        <div><h3>توقيع المستلم</h3><div>...................</div></div>
        <div><h3>الختم</h3><div class="stamp">مكان الختم</div></div>
      </div>
      <div class="thanks">أرض الجوال — شكرًا لثقتكم</div>
    </section>
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
    console.error('Cash receipt render failed:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('تعذر عرض سند القبض حاليًا.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
