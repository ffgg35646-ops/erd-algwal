import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { products as seedProducts } from '@/lib/products';
import { findStoredProduct } from '@/lib/catalog';
import { sendNewOrderToAdmin, makeOrderNumber, type StoreOrder } from '@/lib/orders';
import { adminReplyKeyboard, ensureTelegramIndexes, sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CheckoutBody = {
  submissionId?: string;
  reviewToken?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  region?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  building?: string;
  notes?: string;
  installment?: 'yes' | 'no';
  acceptedPolicies?: boolean;
  customerNotificationKey?: string;
  items?: Array<{ productId?: string; quantity?: number }>;
};

function text(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validPhone(value: string) {
  const normalized = value.replace(/[\\s()-]/g, '');
  return /^(?:\\+?966|0)?5\\d{8}$/.test(normalized) ? normalized : '';
}

function validEmail(value: string) {
  if (!value) return true;
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) && value.length <= 254;
}

export async function POST(request: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await request.json() as CheckoutBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'بيانات الطلب غير صالحة.' }, { status: 400 });
  }

  const submissionId = text(body.submissionId, 80);
  const reviewToken = text(body.reviewToken, 120);
  if (reviewToken && !/^[a-f0-9-]{36}$/i.test(reviewToken)) {
    return NextResponse.json({ ok: false, error: 'رابط التقييم غير صالح. حدّث الصفحة وحاول مرة أخرى.' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json({ ok: false, error: 'معرّف الطلب غير صالح. حدّث الصفحة وحاول مرة أخرى.' }, { status: 400 });
  }

  const customerNotificationKey = text(body.customerNotificationKey, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerNotificationKey)) {
    return NextResponse.json({ ok: false, error: 'تعذر تفعيل إشعارات المتصفح. حدّث الصفحة وحاول مرة أخرى.' }, { status: 400 });
  }

  const fullName = text(body.fullName, 120);
  const phone = validPhone(text(body.phone, 32));
  const email = text(body.email, 254);
  const region = text(body.region, 100);
  const city = text(body.city, 120);
  const neighborhood = text(body.neighborhood, 150);
  const street = text(body.street, 250);
  const building = text(body.building, 120);
  const notes = text(body.notes, 1000);
  const installment = body.installment === 'yes';
  const acceptedPolicies = body.acceptedPolicies === true;

  if (fullName.length < 2) return NextResponse.json({ ok: false, error: 'اكتب الاسم الكامل.' }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: 'رقم الجوال السعودي غير صحيح.' }, { status: 400 });
  if (!validEmail(email)) return NextResponse.json({ ok: false, error: 'البريد الإلكتروني غير صحيح.' }, { status: 400 });
  if (!region || !city || !neighborhood || !street) return NextResponse.json({ ok: false, error: 'أكمل عنوان التوصيل.' }, { status: 400 });
  if (!acceptedPolicies) return NextResponse.json({ ok: false, error: 'الموافقة على سياسة المتجر مطلوبة.' }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return NextResponse.json({ ok: false, error: 'قائمة المنتجات غير صالحة.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureTelegramIndexes(db);
    const orders = db.collection<StoreOrder>('orders');

    const previous = await orders.findOne({ checkoutRequestId: submissionId });
    if (previous) {
      await orders.updateOne({ _id: previous._id }, { $set: { customerNotificationKey } });
      return NextResponse.json({
        ok: true,
        orderId: previous._id.toHexString(),
        orderNumber: previous.orderNumber,
        notificationSent: previous.telegramNotificationSent === true,
        duplicate: true
      });
    }

    const orderItems: StoreOrder['items'] = [];
    for (const line of body.items) {
      const productId = text(line?.productId, 100);
      const quantity = Number(line?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return NextResponse.json({ ok: false, error: 'أحد المنتجات أو الكميات غير صالح.' }, { status: 400 });
      }

      let product: { name: string; price: number } | null = null;
      const seedProduct = seedProducts.find((item) => item.id === productId);
      if (seedProduct) {
        product = { name: seedProduct.name, price: seedProduct.price };
      } else if (ObjectId.isValid(productId)) {
        const stored = await findStoredProduct(db, productId);
        if (stored) product = { name: stored.name, price: stored.price };
      }

      if (!product || !Number.isFinite(product.price) || product.price <= 0) {
        return NextResponse.json({ ok: false, error: 'أحد المنتجات لم يعد متاحًا. حدّث الصفحة وحاول مرة أخرى.' }, { status: 400 });
      }

      const existing = orderItems.find((item) => item.name === product!.name && item.unitPrice === product!.price);
      if (existing) existing.quantity += quantity;
      else orderItems.push({ name: product.name, quantity, unitPrice: product.price });
    }

    const total = orderItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ ok: false, error: 'تعذر حساب إجمالي الطلب.' }, { status: 400 });
    }

    const now = new Date();
    const _id = new ObjectId();
    const order: StoreOrder & { checkoutRequestId: string; acceptedPoliciesAt: Date; adminSeenAt: null; customerNotificationKey: string; reviewToken?: string } = {
      _id,
      orderNumber: makeOrderNumber(_id, now),
      checkoutRequestId: submissionId,
      ...(reviewToken ? { reviewToken } : {}),
      customerNotificationKey,
      source: 'website',
      customer: {
        name: fullName,
        phone,
        ...(email ? { email } : {}),
        address: [region, city, neighborhood, street, building].filter(Boolean).join('، ')
      },
      items: orderItems,
      total,
      currency: 'SAR',
      status: 'new',
      paymentStatus: 'pending',
      installment,
      createdAt: now,
      updatedAt: now,
      adminSeenAt: null,
      acceptedPoliciesAt: now,
      telegramNotificationSent: false,
      ...(notes ? { notes } : {})
    };

    await orders.insertOne(order);

    let notificationSent = false;
    try {
      await sendNewOrderToAdmin(order);
      const adminId = process.env.TELEGRAM_ADMIN_ID;
      if (adminId) {
        const unreadCount = await orders.countDocuments({ source: 'website', adminSeenAt: null });
        await sendTelegramMessage(Number(adminId), 'لديك طلبات جديدة. يمكنك فتح «طلبات العملاء» من القائمة لعرضها.', {
          reply_markup: adminReplyKeyboard(unreadCount)
        });
      }
      notificationSent = true;
      await orders.updateOne({ _id }, { $set: { telegramNotificationSent: true, telegramNotifiedAt: new Date() } });
    } catch (error) {
      console.error('Order saved but Telegram notification failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    return NextResponse.json({
      ok: true,
      orderId: _id.toHexString(),
      orderNumber: order.orderNumber,
      notificationSent,
      message: notificationSent
        ? 'تم حفظ الطلب وإرسال إشعار الإدارة.'
        : 'تم حفظ الطلب، لكن تعذر إرسال إشعار تيليجرام. سيظل محفوظًا في قاعدة البيانات.'
    }, { status: 201 });
  } catch (error) {
    console.error('Create order failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      ok: false,
      error: 'تعذر حفظ الطلب حاليًا. تحقق من إعدادات قاعدة البيانات والبوت ثم حاول مرة أخرى.'
    }, { status: 500 });
  }
}
