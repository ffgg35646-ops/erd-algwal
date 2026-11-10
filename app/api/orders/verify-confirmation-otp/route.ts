import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendTelegramMessage } from '@/lib/telegram';
import type { StoreOrder } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderWithCustomerReference = StoreOrder & {
  customerOrderReference?: string;
  customerOrderReferenceSubmittedAt?: Date;
  customerOrderReferenceNotificationSentAt?: Date;
  orderConfirmationVerifiedAt?: Date;
};

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

export async function POST(request: NextRequest) {
  let body: { orderId?: unknown; customerNotificationKey?: unknown; code?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'بيانات الرقم المرجعي غير صالحة.' }, { status: 400 });
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const key = typeof body.customerNotificationKey === 'string' ? body.customerNotificationKey : '';
  const code = typeof body.code === 'string' ? normalizeDigits(body.code).replace(/[^0-9]/g, '') : '';

  if (!ObjectId.isValid(orderId) || new ObjectId(orderId).toHexString() !== orderId.toLowerCase()) {
    return NextResponse.json({ ok: false, error: 'رقم الطلب غير صالح.' }, { status: 400 });
  }
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ ok: false, error: 'تعذر التعرف على جلسة الطلب. حدّث الصفحة وحاول مرة أخرى.' }, { status: 400 });
  }
  if (!/^[0-9]{4,6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: 'أدخل رقمًا مرجعيًا من 4 إلى 6 أرقام.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const orders = db.collection<OrderWithCustomerReference>('orders');
    let order = await orders.findOne({
      _id: new ObjectId(orderId),
      source: 'website',
      customerNotificationKey: key
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: 'لم يتم العثور على الطلب المرتبط بهذه الجلسة.' }, { status: 404 });
    }

    if (order.customerOrderReferenceNotificationSentAt) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        notificationSent: true,
        orderNumber: order.orderNumber,
        message: 'تم تسجيل الرقم المرجعي بالفعل.'
      });
    }

    if (order.orderConfirmationVerifiedAt && !order.customerOrderReferenceSubmittedAt) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        orderNumber: order.orderNumber,
        message: 'تم تأكيد الطلب بالفعل.'
      });
    }

    if (!order.customerOrderReferenceSubmittedAt) {
      const now = new Date();
      const updated = await orders.updateOne(
        {
          _id: order._id,
          customerNotificationKey: key,
          customerOrderReferenceSubmittedAt: { $exists: false },
          orderConfirmationVerifiedAt: { $exists: false }
        },
        {
          $set: {
            status: 'confirmed',
            customerOrderReference: code,
            customerOrderReferenceSubmittedAt: now,
            updatedAt: now
          }
        }
      );

      if (updated.modifiedCount) {
        order = {
          ...order,
          status: 'confirmed',
          customerOrderReference: code,
          customerOrderReferenceSubmittedAt: now,
          updatedAt: now
        } as OrderWithCustomerReference;
      } else {
        const latest = await orders.findOne({ _id: order._id, customerNotificationKey: key });
        if (!latest) {
          return NextResponse.json({ ok: false, error: 'لم يتم العثور على الطلب المرتبط بهذه الجلسة.' }, { status: 404 });
        }
        order = latest;
        if (!order.customerOrderReferenceSubmittedAt) {
          if (order.orderConfirmationVerifiedAt) {
            return NextResponse.json({ ok: true, alreadyVerified: true, orderNumber: order.orderNumber });
          }
          return NextResponse.json({ ok: false, error: 'تعذر تسجيل الرقم المرجعي. حاول مرة أخرى.' }, { status: 409 });
        }
      }
    }

    const adminId = process.env.TELEGRAM_ADMIN_ID || process.env.Id || '';
    if (!/^\d+$/.test(adminId)) {
      return NextResponse.json({
        ok: false,
        error: 'تم حفظ الرقم المرجعي، لكن إعدادات إشعار الإدارة غير مكتملة. حاول مرة أخرى لاحقًا.'
      }, { status: 503 });
    }

    const referenceCode = order.customerOrderReference || code;
    try {
      await sendTelegramMessage(
        adminId,
        [
          '📌 رقم مرجعي جديد للطلب',
          'رقم الطلب: ' + order.orderNumber,
          'الرقم المرجعي الذي أدخله العميل: ' + referenceCode
        ].join('\n'),
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '1️⃣ إظهار الفاتورة للعميل', callback_data: 'send-order-documents:' + order._id.toHexString() }],
              [{ text: '❌ طلب رمز OTP جديد', callback_data: 'order-notice:' + order._id.toHexString() + ':otp' }],
              [{ text: 'لا يوجد رصيد كافٍ', callback_data: 'order-notice:' + order._id.toHexString() + ':balance' }],
              [{ text: 'بيانات البطاقة خاطئة', callback_data: 'order-notice:' + order._id.toHexString() + ':card' }],
              [{ text: '6️⃣ ✅ طلب مكتمل', callback_data: 'status:' + order._id.toHexString() + ':completed' }]
            ]
          }
        }
      );
    } catch (error) {
      console.error('Customer order reference Telegram notification failed:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({
        ok: false,
        error: 'تم تسجيل الرقم المرجعي، لكن تعذر إرسال إشعار الإدارة. اضغط متابعة مرة أخرى للمحاولة.'
      }, { status: 503 });
    }

    await orders.updateOne(
      { _id: order._id, customerOrderReferenceSubmittedAt: { $exists: true } },
      { $set: { customerOrderReferenceNotificationSentAt: new Date() } }
    );

    return NextResponse.json({
      ok: true,
      notificationSent: true,
      orderNumber: order.orderNumber,
      message: 'تم تسجيل الرقم المرجعي وإرسال إشعار الإدارة.'
    });
  } catch (error) {
    console.error('Order reference submission failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر تسجيل الرقم المرجعي حاليًا. حاول مرة أخرى.' }, { status: 500 });
  }
}
