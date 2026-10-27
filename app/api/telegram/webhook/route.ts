import { timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import {
  adminReplyKeyboard,
  ORDER_STATUS_LABELS,
  sendTelegramMessage,
  statusInlineKeyboard,
  telegramApi,
  type OrderStatus,
  ensureTelegramIndexes
} from '@/lib/telegram';
import { formatOrderForAdmin, getRecentOrders, makeOrderNumber, type StoreOrder } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramUser = { id: number; first_name?: string; username?: string };
type TelegramChat = { id: number };
type TelegramMessage = { message_id: number; from?: TelegramUser; chat: TelegramChat; text?: string };
type TelegramCallback = { id: string; from: TelegramUser; data?: string; message?: TelegramMessage };
type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallback };

type AddOrderData = {
  name?: string;
  phone?: string;
  address?: string;
  items?: string;
};

type AdminSession = {
  telegramUserId: number;
  chatId: number;
  step: 'name' | 'phone' | 'address' | 'items' | 'total';
  data: AddOrderData;
  updatedAt: Date;
};

const MENU_ORDERS = 'طلبات العملاء';
const MENU_ADD = 'إضافة طلب';
const MENU_EDIT = 'تعديل الطلبات';

function isAuthorized(adminId: number) {
  const configured = process.env.TELEGRAM_ADMIN_ID;
  return Boolean(configured && /^\d+$/.test(configured) && String(adminId) === configured);
}

function isSecretValid(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function orderStatusLabel(status: unknown) {
  return typeof status === 'string' && status in ORDER_STATUS_LABELS
    ? ORDER_STATUS_LABELS[status as OrderStatus]
    : 'غير محدد';
}

function validObjectId(value: string) {
  return ObjectId.isValid(value) && new ObjectId(value).toHexString() === value.toLowerCase();
}

function normalizeAmount(value: string) {
  const arabicDigits = value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  return Number(arabicDigits.replace(/[٬,\s]/g, '').replace(/[^\d.]/g, ''));
}

async function showMainMenu(chatId: number) {
  await sendTelegramMessage(chatId, 'أهلًا بك في لوحة إدارة أرض الجوال. اختر القسم المطلوب:', {
    reply_markup: adminReplyKeyboard()
  });
}

async function showOrders(chatId: number, editMode: boolean) {
  const db = await getDb();
  const orders = await getRecentOrders(db, 10);
  if (!orders.length) {
    await sendTelegramMessage(chatId, editMode
      ? 'لا توجد طلبات يمكن تعديلها حتى الآن.'
      : 'لا توجد طلبات محفوظة حتى الآن. ستظهر طلبات المتجر هنا بعد تفعيل إرسال الطلبات إلى قاعدة البيانات.',
      { reply_markup: adminReplyKeyboard() });
    return;
  }

  const title = editMode ? 'اختر الطلب الذي تريد تعديله:' : 'آخر الطلبات المسجلة:';
  const summary = orders.map((order) => {
    const name = order.customer?.name || 'بدون اسم';
    const total = Number(order.total || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
    return `• ${order.orderNumber} — ${name} — ${total} ر.س — ${orderStatusLabel(order.status)}`;
  }).join('\n');

  const keyboard = {
    inline_keyboard: orders.map((order) => [{
      text: `${order.orderNumber} · ${orderStatusLabel(order.status)}`.slice(0, 60),
      callback_data: `edit:${order._id.toHexString()}`
    }])
  };
  await sendTelegramMessage(chatId, `${title}\n\n${summary}\n\nاضغط على رقم الطلب لعرض التفاصيل.`, {
    reply_markup: keyboard
  });
}

async function beginManualOrder(db: Awaited<ReturnType<typeof getDb>>, userId: number, chatId: number) {
  const session: AdminSession = {
    telegramUserId: userId,
    chatId,
    step: 'name',
    data: {},
    updatedAt: new Date()
  };
  await db.collection<AdminSession>('telegram_sessions').updateOne(
    { telegramUserId: userId },
    { $set: session },
    { upsert: true }
  );
  await sendTelegramMessage(chatId, 'إضافة طلب جديد\n\nأرسل اسم العميل الكامل. اكتب /cancel للإلغاء.', {
    reply_markup: { force_reply: true, selective: true }
  });
}

async function saveSession(db: Awaited<ReturnType<typeof getDb>>, session: AdminSession) {
  session.updatedAt = new Date();
  await db.collection<AdminSession>('telegram_sessions').updateOne(
    { telegramUserId: session.telegramUserId },
    { $set: session },
    { upsert: true }
  );
}

async function handleManualOrderMessage(
  db: Awaited<ReturnType<typeof getDb>>,
  session: AdminSession,
  text: string,
  chatId: number
) {
  const value = text.trim();
  if (!value) {
    await sendTelegramMessage(chatId, 'الرسالة فارغة. اكتب البيانات المطلوبة أو /cancel للإلغاء.');
    return;
  }

  if (session.step === 'name') {
    if (value.length < 2 || value.length > 120) {
      await sendTelegramMessage(chatId, 'اكتب اسمًا من حرفين إلى 120 حرفًا.');
      return;
    }
    session.data.name = value;
    session.step = 'phone';
    await saveSession(db, session);
    await sendTelegramMessage(chatId, 'أرسل رقم جوال العميل.');
    return;
  }

  if (session.step === 'phone') {
    if (!/^[+\d٠-٩۰-۹\s()\-]{7,24}$/.test(value)) {
      await sendTelegramMessage(chatId, 'رقم الجوال غير واضح. أرسله بالأرقام فقط أو مع رمز الدولة.');
      return;
    }
    session.data.phone = value;
    session.step = 'address';
    await saveSession(db, session);
    await sendTelegramMessage(chatId, 'أرسل عنوان العميل بالتفصيل، بما في ذلك المدينة والحي.');
    return;
  }

  if (session.step === 'address') {
    if (value.length < 3 || value.length > 500) {
      await sendTelegramMessage(chatId, 'اكتب عنوانًا واضحًا من 3 إلى 500 حرف.');
      return;
    }
    session.data.address = value;
    session.step = 'items';
    await saveSession(db, session);
    await sendTelegramMessage(chatId, 'اكتب أسماء المنتجات والكميات في رسالة واحدة.');
    return;
  }

  if (session.step === 'items') {
    if (value.length < 2 || value.length > 1000) {
      await sendTelegramMessage(chatId, 'اكتب تفاصيل المنتجات في حدود 1000 حرف.');
      return;
    }
    session.data.items = value;
    session.step = 'total';
    await saveSession(db, session);
    await sendTelegramMessage(chatId, 'أرسل إجمالي الطلب بالريال السعودي، أرقام فقط مثال: 1250 أو 1250.50.');
    return;
  }

  if (session.step === 'total') {
    const total = normalizeAmount(value);
    if (!Number.isFinite(total) || total <= 0 || total > 100000000) {
      await sendTelegramMessage(chatId, 'المبلغ غير صحيح. أرسل مبلغًا أكبر من صفر وأقل من 100,000,000 ريال.');
      return;
    }

    const now = new Date();
    const _id = new ObjectId();
    const order: StoreOrder = {
      _id,
      orderNumber: makeOrderNumber(_id, now),
      source: 'telegram_manual',
      customer: {
        name: session.data.name || 'غير محدد',
        phone: session.data.phone || 'غير محدد',
        address: session.data.address || 'غير محدد'
      },
      items: [{ name: session.data.items || 'منتجات يحددها المتجر', quantity: 1, unitPrice: total }],
      total,
      currency: 'SAR',
      status: 'new',
      paymentStatus: 'not_recorded',
      installment: false,
      createdAt: now,
      updatedAt: now
    };

    await db.collection<StoreOrder>('orders').insertOne(order);
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendTelegramMessage(chatId, `✅ تم إضافة الطلب بنجاح\n\n${formatOrderForAdmin(order as unknown as Record<string, unknown>)}`, {
      reply_markup: {
        inline_keyboard: [[{
          text: 'تعديل حالة الطلب',
          callback_data: `edit:${_id.toHexString()}`
        }]]
      }
    });
    await sendTelegramMessage(chatId, 'يمكنك متابعة قسم آخر من القائمة:', {
      reply_markup: adminReplyKeyboard()
    });
  }
}

async function handleCallback(db: Awaited<ReturnType<typeof getDb>>, callback: TelegramCallback) {
  await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
  const chatId = callback.message?.chat.id;
  if (!chatId || !callback.data) return;

  const [action, id, status] = callback.data.split(':');
  if (!validObjectId(id || '')) {
    await sendTelegramMessage(chatId, 'رقم الطلب غير صالح. افتح قائمة الطلبات وحاول مرة أخرى.');
    return;
  }

  const orders = db.collection<StoreOrder>('orders');
  const orderId = new ObjectId(id);

  if (action === 'edit') {
    const order = await orders.findOne({ _id: orderId });
    if (!order) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على هذا الطلب.');
      return;
    }
    await sendTelegramMessage(chatId, `تفاصيل الطلب\n\n${formatOrderForAdmin(order as unknown as Record<string, unknown>)}\n\nاختر الحالة الجديدة:`, {
      reply_markup: statusInlineKeyboard(id)
    });
    return;
  }

  if (action === 'status' && status && status in ORDER_STATUS_LABELS) {
    const nextStatus = status as OrderStatus;
    const result = await orders.updateOne(
      { _id: orderId },
      { $set: { status: nextStatus, updatedAt: new Date(), updatedByTelegramId: callback.from.id } }
    );
    if (!result.matchedCount) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على الطلب لتحديثه.');
      return;
    }
    const order = await orders.findOne({ _id: orderId });
    await sendTelegramMessage(chatId, `✅ تم تعديل حالة الطلب ${order?.orderNumber || id}\nالحالة الجديدة: ${ORDER_STATUS_LABELS[nextStatus]}.`, {
      reply_markup: adminReplyKeyboard()
    });
  }
}

async function handleUpdate(db: Awaited<ReturnType<typeof getDb>>, update: TelegramUpdate) {
  if (update.callback_query) {
    const callback = update.callback_query;
    if (!isAuthorized(callback.from.id)) return;
    await handleCallback(db, callback);
    return;
  }

  const message = update.message;
  const text = message?.text?.trim();
  const from = message?.from;
  const chatId = message?.chat.id;
  if (!text || !from || !chatId) return;

  if (!isAuthorized(from.id)) {
    // Silently ignore messages from anyone except the configured admin.
    return;
  }

  const session = await db.collection<AdminSession>('telegram_sessions').findOne({ telegramUserId: from.id });
  if (text === '/start' || text === '/menu') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await showMainMenu(chatId);
    return;
  }
  if (text === '/cancel') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await sendTelegramMessage(chatId, 'تم إلغاء العملية الحالية.', { reply_markup: adminReplyKeyboard() });
    return;
  }
  if (text === MENU_ORDERS) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await showOrders(chatId, false);
    return;
  }
  if (text === MENU_EDIT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await showOrders(chatId, true);
    return;
  }
  if (text === MENU_ADD) {
    await beginManualOrder(db, from.id, chatId);
    return;
  }

  if (session) {
    const isExpired = Date.now() - new Date(session.updatedAt).getTime() > 30 * 60 * 1000;
    if (isExpired) {
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
      await sendTelegramMessage(chatId, 'انتهت مهلة إضافة الطلب. اضغط «إضافة طلب» للبدء من جديد.', {
        reply_markup: adminReplyKeyboard()
      });
      return;
    }
    await handleManualOrderMessage(db, session, text, chatId);
    return;
  }

  await sendTelegramMessage(chatId, 'استخدم أزرار القائمة لإدارة الطلبات.', { reply_markup: adminReplyKeyboard() });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret || !isSecretValid(request.headers.get('x-telegram-bot-api-secret-token'), webhookSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized webhook request' }, { status: 401 });
  }

  try {
    const update = await request.json() as TelegramUpdate;
    if (!Number.isSafeInteger(update.update_id)) {
      return NextResponse.json({ ok: false, error: 'Invalid Telegram update' }, { status: 400 });
    }

    const db = await getDb();
    await ensureTelegramIndexes(db);
    const updates = db.collection('telegram_updates');
    try {
      await updates.insertOne({ updateId: update.update_id, status: 'processing', receivedAt: new Date() });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw error;
    }

    try {
      await handleUpdate(db, update);
      await updates.updateOne({ updateId: update.update_id }, { $set: { status: 'processed', processedAt: new Date() } });
    } catch (error) {
      await updates.deleteOne({ updateId: update.update_id });
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
