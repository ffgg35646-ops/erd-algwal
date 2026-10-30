import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { formatOrderForAdmin, type StoreOrder } from '@/lib/orders';
import { adminReplyKeyboard, ensureTelegramIndexes, sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethodBody = {
  orderId?: string;
  submissionId?: string;
  reviewToken?: string;
  paymentMethod?: 'mada' | 'visa';
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

  if (!/^[a-f0-9]{24}$/i.test(orderId) || !UUID_PATTERN.test(submissionId) || !UUID_PATTERN.test(reviewToken)) {
    return NextResponse.json({ ok: false, error: 'تعذر التحقق من الطلب. ارجع لبيانات التوصيل وحاول مرة أخرى.' }, { status: 400 });
  }
  if (paymentMethod !== 'mada' && paymentMethod !== 'visa') {
    return NextResponse.json({ ok: false, error: 'اختر بطاقة Visa أو مدى.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureTelegramIndexes(db);
    const orders = db.collection<StoreOrder & { checkoutRequestId?: string; reviewToken?: string; adminSeenAt?: Date | null }>('orders');
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

    const now = new Date();
    await orders.updateOne(filter, {
      $set: {
        paymentMethod,
        paymentMethodSelectedAt: now,
        paymentStatus: 'pending',
        adminSeenAt: null,
        updatedAt: now
      }
    });
    const updatedOrder = await orders.findOne(filter);
    if (!updatedOrder) {
      return NextResponse.json({ ok: false, error: 'تعذر تحديث طريقة الدفع في الطلب.' }, { status: 500 });
    }

    let notificationSent = false;
    const adminId = Number(process.env.TELEGRAM_ADMIN_ID || '');
    if (Number.isSafeInteger(adminId) && adminId > 0) {
      try {
        const unreadCount = await orders.countDocuments({ source: 'website', adminSeenAt: null });
        const methodLabel = paymentMethod === 'mada' ? 'مدى' : 'Visa';
        await sendTelegramMessage(
          adminId,
          '💳 اختار العميل طريقة الدفع لطلب ' + (updatedOrder.orderNumber || orderId) +
            '\nالطريقة المختارة: ' + methodLabel +
            '\n\n' + formatOrderForAdmin(updatedOrder as unknown as Record<string, unknown>) +
            '\n\nملاحظة: هذا اختيار لطريقة الدفع فقط، ولم يتم تنفيذ خصم إلكتروني.',
          { reply_markup: adminReplyKeyboard(unreadCount) }
        );
        notificationSent = true;
      } catch (error) {
        console.error('Payment-method admin notification failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    return NextResponse.json({
      ok: true,
      notificationSent,
      paymentMethod,
      paymentStatus: 'pending',
      message: notificationSent
        ? 'تم حفظ اختيار طريقة الدفع وإرسال الطلب للإدارة.'
        : 'تم حفظ اختيار طريقة الدفع، لكن تعذر إرسال إشعار تيليجرام.'
    });
  } catch (error) {
    console.error('Payment method selection failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر حفظ اختيار طريقة الدفع حاليًا.' }, { status: 500 });
  }
}
