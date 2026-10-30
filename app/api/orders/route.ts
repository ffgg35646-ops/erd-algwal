import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ensureDefaultProducts, findStoredProduct } from '@/lib/catalog';
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
  idNumber?: string;
  city?: string;
  addressDetails?: string;
  neighborhood?: string;
  street?: string;
  building?: string;
  notes?: string;
  installment?: 'yes' | 'no';
  installmentDownPayment?: number;
  installmentMonths?: number;
  acceptedPolicies?: boolean;
  warrantyPolicyUpdatedAt?: string;
  customerNotificationKey?: string;
  items?: Array<{ productId?: string; quantity?: number; color?: string }>;
};

function text(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validPhone(value: string) {
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  return /^05[0-9]{8}$/.test(normalized) ? normalized : '';
}
function validEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

const CUSTOMER_BROWSER_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const noStore = { 'cache-control': 'no-store, max-age=0' };
  if (!key || !CUSTOMER_BROWSER_KEY_PATTERN.test(key)) {
    return NextResponse.json({ ok: false, error: 'مفتاح المتصفح غير صالح.' }, { status: 400, headers: noStore });
  }

  try {
    const db = await getDb();
    const savedOrders = await db.collection<StoreOrder>('orders')
      .find({ source: 'website', customerNotificationKey: key })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      ok: true,
      orders: savedOrders.map((order) => ({
        id: order._id.toHexString(),
        orderNumber: order.orderNumber,
        createdAt: new Date(order.createdAt).toISOString(),
        status: order.status,
        paymentStatus: order.paymentStatus,
        installment: order.installment === true,
        installmentDownPayment: order.installmentDownPayment ?? null,
        installmentMonths: order.installmentMonths ?? null,
        notes: order.notes || '',
        customerName: order.customer?.name || '',
        customerPhone: order.customer?.phone || '',
        customerAddress: order.customer?.address || '',
        items: (order.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          ...(typeof item.unitPrice === 'number' ? { unitPrice: item.unitPrice } : {}),
          ...(item.color ? { color: item.color } : {})
        })),
        total: Number(order.total || 0),
        currency: order.currency || 'SAR'
      }))
    }, { headers: noStore });
  } catch (error) {
    console.error('Customer order history read failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر تحميل تاريخ الطلبات حاليًا.' }, { status: 500, headers: noStore });
  }
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
  const idNumber = text(body.idNumber, 20)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^0-9]/g, '');
  const city = text(body.city, 120);
  const addressDetails = text(body.addressDetails || [body.neighborhood, body.street, body.building].filter(Boolean).join('، '), 500);
  const notes = text(body.notes, 1000);
  const installment = body.installment === 'yes';
  const installmentDownPayment = Number(body.installmentDownPayment);
  const installmentMonths = Number(body.installmentMonths);
  const acceptedPolicies = body.acceptedPolicies === true;
  const warrantyPolicyUpdatedAt = text(body.warrantyPolicyUpdatedAt, 40);

  if (fullName.length < 2) return NextResponse.json({ ok: false, error: 'اكتب الاسم الكامل.' }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: 'رقم الجوال السعودي غير صحيح.' }, { status: 400 });
  if (!email || !validEmail(email)) return NextResponse.json({ ok: false, error: 'اكتب بريدًا إلكترونيًا صحيحًا.' }, { status: 400 });
  if (!/^[0-9]{10}$/.test(idNumber)) return NextResponse.json({ ok: false, error: 'رقم الهوية أو الإقامة يجب أن يتكون من 10 أرقام.' }, { status: 400 });
  if (!city || !addressDetails) return NextResponse.json({ ok: false, error: 'أكمل تفاصيل عنوان التوصيل.' }, { status: 400 });
  if (installment && (
    ![500, 750, 1000, 1500, 2000].includes(installmentDownPayment) ||
    ![3, 6, 12, 24].includes(installmentMonths)
  )) return NextResponse.json({ ok: false, error: 'اختر الدفعة المقدمة ومدة التقسيط.' }, { status: 400 });
  if (!acceptedPolicies) return NextResponse.json({ ok: false, error: 'الموافقة على سياسة المتجر مطلوبة.' }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return NextResponse.json({ ok: false, error: 'قائمة المنتجات غير صالحة.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureTelegramIndexes(db);
    await ensureDefaultProducts(db);
    const orders = db.collection<StoreOrder>('orders');
    const warrantyPolicy = await db.collection<{ _id: string; content?: string; updatedAt?: Date }>('store_pages')
      .findOne({ _id: 'warranty' });
    const warrantyPolicyContent = typeof warrantyPolicy?.content === 'string' ? warrantyPolicy.content.trim() : '';
    const currentWarrantyPolicyUpdatedAt = warrantyPolicy?.updatedAt instanceof Date
      ? warrantyPolicy.updatedAt.toISOString()
      : '';
    if (!warrantyPolicyContent || !currentWarrantyPolicyUpdatedAt) {
      return NextResponse.json({ ok: false, error: 'الإدارة لم تنشر سياسة الضمان بعد، ولا يمكن إكمال الطلب حاليًا.' }, { status: 409 });
    }
    if (!acceptedPolicies) {
      return NextResponse.json({ ok: false, error: 'يجب الموافقة على سياسة الضمان قبل إكمال الطلب.' }, { status: 400 });
    }
    if (!warrantyPolicyUpdatedAt || warrantyPolicyUpdatedAt !== currentWarrantyPolicyUpdatedAt) {
      return NextResponse.json({ ok: false, error: 'تم تحديث سياسة الضمان. افتحها مرة أخرى ووافق على النسخة الحالية.' }, { status: 409 });
    }

    const previous = await orders.findOne({ checkoutRequestId: submissionId });
    if (previous) {
      await orders.updateOne({ _id: previous._id }, { $set: { customerNotificationKey } });
      return NextResponse.json({
        ok: true,
        orderId: previous._id.toHexString(),
        orderNumber: previous.orderNumber,
        total: Number(previous.total || 0),
        currency: previous.currency || 'SAR',
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

      let product: { name: string; price: number; colors?: string[] } | null = null;
      const selectedColor = text(line?.color, 60);
      const stored = await findStoredProduct(db, productId);
      if (stored) product = { name: stored.name, price: stored.price, colors: stored.colors || [] };

      if (selectedColor && !product?.colors?.includes(selectedColor)) {
        return NextResponse.json({ ok: false, error: 'اللون المختار غير متاح لهذا المنتج. حدّث السلة واختر لونًا متاحًا.' }, { status: 400 });
      }

      if (!product || !Number.isFinite(product.price) || product.price <= 0) {
        return NextResponse.json({ ok: false, error: 'أحد المنتجات لم يعد متاحًا. حدّث الصفحة وحاول مرة أخرى.' }, { status: 400 });
      }

      const existing = orderItems.find((item) => item.name === product!.name && item.unitPrice === product!.price && (item.color || '') === selectedColor);
      if (existing) existing.quantity += quantity;
      else orderItems.push({ name: product.name, quantity, unitPrice: product.price, ...(selectedColor ? { color: selectedColor } : {}) });
    }

    const total = orderItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ ok: false, error: 'تعذر حساب إجمالي الطلب.' }, { status: 400 });
    }

    const now = new Date();
    const _id = new ObjectId();
    const order: StoreOrder & {
      checkoutRequestId: string;
      acceptedPoliciesAt: Date;
      acceptedWarrantyPolicyAt: Date;
      acceptedWarrantyPolicyUpdatedAt: string;
      acceptedWarrantyPolicyContent: string;
      adminSeenAt: null;
      customerNotificationKey: string;
      reviewToken?: string;
    } = {
      _id,
      orderNumber: makeOrderNumber(_id, now),
      checkoutRequestId: submissionId,
      ...(reviewToken ? { reviewToken } : {}),
      customerNotificationKey,
      source: 'website',
      customer: {
        name: fullName,
        phone,
        idNumber,
        ...(email ? { email } : {}),
        address: [city, addressDetails].filter(Boolean).join('، ')
      },
      items: orderItems,
      total,
      currency: 'SAR',
      status: 'new',
      paymentStatus: 'pending',
      installment,
      ...(installment ? { installmentDownPayment, installmentMonths } : {}),
      createdAt: now,
      updatedAt: now,
      adminSeenAt: null,
      acceptedPoliciesAt: now,
      acceptedWarrantyPolicyAt: now,
      acceptedWarrantyPolicyUpdatedAt: currentWarrantyPolicyUpdatedAt,
      acceptedWarrantyPolicyContent: warrantyPolicyContent,
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
      total: order.total,
      currency: order.currency,
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
