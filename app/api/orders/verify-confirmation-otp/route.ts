import { createHash, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { StoreOrder } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderWithConfirmationOtp = StoreOrder & {
  orderConfirmationOtpHash?: string;
  orderConfirmationOtpSalt?: string;
  orderConfirmationOtpIssuedAt?: Date;
  orderConfirmationOtpVersion?: number;
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
    return NextResponse.json({ ok: false, error: 'بيانات التأكيد غير صالحة.' }, { status: 400 });
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
  if (!/^[0-9]{4}$/.test(code)) {
    return NextResponse.json({ ok: false, error: 'أدخل رمز التأكيد المكوّن من أربعة أرقام.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const orders = db.collection<OrderWithConfirmationOtp>('orders');
    const order = await orders.findOne({
      _id: new ObjectId(orderId),
      source: 'website',
      customerNotificationKey: key
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: 'لم يتم العثور على الطلب المرتبط بهذه الجلسة.' }, { status: 404 });
    }
    if (order.orderConfirmationVerifiedAt) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        orderNumber: order.orderNumber,
        message: 'تم تأكيد الطلب بالفعل.'
      });
    }
    if (!order.orderConfirmationOtpHash || !order.orderConfirmationOtpSalt) {
      return NextResponse.json({ ok: false, error: 'لم تنشئ الإدارة رمز تأكيد لهذا الطلب بعد.' }, { status: 409 });
    }

    const expected = Buffer.from(order.orderConfirmationOtpHash, 'hex');
    const actual = Buffer.from(
      createHash('sha256').update(order.orderConfirmationOtpSalt + ':' + code).digest('hex'),
      'hex'
    );
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return NextResponse.json({ ok: false, error: 'رمز التأكيد غير صحيح. راجع الرمز وحاول مرة أخرى.' }, { status: 400 });
    }

    const now = new Date();
    const updated = await orders.updateOne(
      {
        _id: order._id,
        customerNotificationKey: key,
        orderConfirmationOtpHash: order.orderConfirmationOtpHash,
        orderConfirmationVerifiedAt: { $exists: false }
      },
      {
        $set: {
          status: 'confirmed',
          orderConfirmationVerifiedAt: now,
          updatedAt: now
        },
        $unset: {
          orderConfirmationOtpHash: '',
          orderConfirmationOtpSalt: '',
          orderConfirmationOtpIssuedAt: ''
        }
      }
    );

    if (!updated.modifiedCount) {
      const latest = await orders.findOne({ _id: order._id, customerNotificationKey: key });
      if (latest?.orderConfirmationVerifiedAt) {
        return NextResponse.json({
          ok: true,
          alreadyVerified: true,
          orderNumber: latest.orderNumber,
          message: 'تم تأكيد الطلب بالفعل.'
        });
      }
      return NextResponse.json({ ok: false, error: 'تم تحديث رمز التأكيد. اطلب الرمز الحالي وحاول مرة أخرى.' }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      message: 'تم تأكيد طلبك بنجاح.'
    });
  } catch (error) {
    console.error('Order confirmation OTP failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر تأكيد الطلب حاليًا. حاول مرة أخرى.' }, { status: 500 });
  }
}
