import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { formatOrderForAdmin, type StoreOrder } from '@/lib/orders';
import { ensureTelegramIndexes, sendTelegramMessage, statusInlineKeyboard } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethodBody = {
  orderId?: string;
  submissionId?: string;
  reviewToken?: string;
  paymentMethod?: 'mada' | 'visa';
  cardholderName?: string;
  cardLast4?: string;
  expiryMonth?: string;
  expiryYear?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: PaymentMethodBody;
  try {
    body = await request.json() as PaymentMethodBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'بيانات اختيار الدفع غير صالحة.' }, { status: 400 });
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
  const reviewToken = typeof body.reviewToken === 'string' ? body.reviewToken.trim() : '';
  const paymentMethod = body.paymentMethod;
  const cardholderName = typeof body.cardholderName === 'string' ? body.cardholderName.trim().slice(0, 100) : '';
  const cardLast4 = typeof body.cardLast4 === 'string' ? body.cardLast4.replace(/\D/g, '') : '';
  const expiryMonth = typeof body.expiryMonth === 'string' ? body.expiryMonth.trim() : '';
  const expiryYear = typeof body.expiryYear === 'string' ? body.expiryYear.trim() : '';

  if (!/^[a-f0-9]{24}$/i.test(orderId) || !UUID_PATTERN.test(submissionId) || !UUID_PATTERN.test(reviewToken)) {
    return NextResponse.json({ ok: false, error: 'تعذر التحقق من الطلب. ارجع لبيانات التوصيل وحاول مرة أخرى.' }, { status: 400 });
  }
  if (paymentMethod !== 'mada' && paymentMethod !== 'visa') {
    return NextResponse.json({ ok: false, error: 'اختر بطاقة Visa أو مدى.' }, { status: 400 });
  }
  if (paymentMethod === 'visa' && (
    !cardholderName ||
    !/^[0-9]{4}$/.test(cardLast4) ||
    !/^(0[1-9]|1[0-2])$/.test(expiryMonth) ||
    !/^[0-9]{4}$/.test(expiryYear)
  )) {
    return NextResponse.json({ ok: false, error: 'أدخل اسم حامل البطاقة وآخر أربعة أرقام وتاريخ الانتهاء بشكل صحيح.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureTelegramIndexes(db);
    const orders = db.collection<StoreOrder & {
      checkoutRequestId?: string;
      reviewToken?: string;
      adminSeenAt?: Date | null;
      adminNotificationSentAt?: Date;
      // Legacy fields are typed here only so the previous stored values can be removed.
      cardholderName?: string;
      cardNumber?: string;
      cvv?: string;
      expiryMonth?: string;
      expiryYear?: string;
    }>('orders');
    const filter = {
      _id: new ObjectId(orderId),
      source: 'website' as const,
      checkoutRequestId: submissionId,
      reviewToken
    };

    const order = await orders.findOne(filter);
    if (!order) {
      return NextResponse.json({ ok: false, error: 'لم يتم العثور على الطلب أو تعذر التحقق من ملكيته.' }, { status: 404 });
    }

    // The final order notification is sent only once, after payment method selection.
    if (order.adminNotificationSentAt) {
      return NextResponse.json({
        ok: true,
        notificationSent: true,
        paymentMethod: order.paymentMethod || paymentMethod,
        paymentStatus: order.paymentStatus || 'pending',
        alreadySubmitted: true
      });
    }

    const now = new Date();
    await orders.updateOne(filter, {
      $set: {
        paymentMethod,
        ...(paymentMethod === 'visa'
          ? { cardholderName, cardLast4, expiryMonth, expiryYear }
          : {}),
        paymentMethodSelectedAt: now,
        paymentStatus: 'pending',
        ...(!order.installment ? { receiptToken: order.receiptToken || randomBytes(24).toString('hex') } : {}),
        adminSeenAt: null,
        updatedAt: now
      },
      // Remove any sensitive card fields saved by the previous version of this endpoint.
      $unset: {
        cardNumber: '',
        cvv: '',
        ...(paymentMethod === 'mada'
          ? { cardholderName: '', cardLast4: '', expiryMonth: '', expiryYear: '' }
          : {})
      }
    });

    const updatedOrder = await orders.findOne(filter);
    if (!updatedOrder) {
      return NextResponse.json({ ok: false, error: 'تعذر تحديث طريقة الدفع في الطلب.' }, { status: 500 });
    }

    const adminId = Number(process.env.TELEGRAM_ADMIN_ID || '');
    if (!Number.isSafeInteger(adminId) || adminId <= 0) {
      return NextResponse.json({
        ok: true,
        notificationSent: false,
        paymentMethod,
        paymentStatus: 'pending',
        message: 'تم حفظ الطلب، لكن لم يتم ضبط مستلم إشعارات الإدارة.'
      });
    }

    try {
      const receiptUrl = !updatedOrder.installment && updatedOrder.receiptToken
        ? new URL(`/receipt/print/${updatedOrder.receiptToken}`, request.nextUrl.origin).toString()
        : '';
      const orderKeyboard = statusInlineKeyboard(orderId);
      const inlineRows = [...orderKeyboard.inline_keyboard];
      if (receiptUrl) inlineRows.push([{ text: '🧾 فتح سند القبض', url: receiptUrl }]);

      await sendTelegramMessage(
        adminId,
        '🛍️ تم إكمال طلب جديد — أرض الجوال\n\n' +
          formatOrderForAdmin(updatedOrder as unknown as Record<string, unknown>) +
          '\n\nاستخدم الأزرار لتحديث حالة الطلب.',
        { reply_markup: { inline_keyboard: inlineRows } }
      );
      const notifiedAt = new Date();
      await orders.updateOne(filter, {
        $set: {
          adminNotificationSentAt: notifiedAt,
          telegramNotificationSent: true,
          telegramNotifiedAt: notifiedAt
        }
      });

      return NextResponse.json({
        ok: true,
        notificationSent: true,
        paymentMethod,
        paymentStatus: 'pending',
        message: 'تم حفظ الطلب وإرسال بياناته وطريقة الدفع للإدارة في رسالة واحدة.'
      });
    } catch (error) {
      console.error('Combined order admin notification failed:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({
        ok: true,
        notificationSent: false,
        paymentMethod,
        paymentStatus: 'pending',
        message: 'تم حفظ الطلب، لكن تعذر إرسال إشعار تيليجرام. اضغط إكمال الطلب مرة أخرى للمحاولة.'
      });
    }
  } catch (error) {
    console.error('Payment method selection failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر حفظ اختيار طريقة الدفع حاليًا.' }, { status: 500 });
  }
}
