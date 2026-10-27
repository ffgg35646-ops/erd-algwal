import { timingSafeEqual } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ensureDefaultCategories, type StoreCategory, type StoredProduct } from '@/lib/catalog';
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
type TelegramPhoto = { file_id: string; file_unique_id: string; width: number; height: number };
type TelegramChat = { id: number; type?: 'private' | 'group' | 'supergroup' | 'channel' };
type TelegramMessage = { message_id: number; from?: TelegramUser; chat: TelegramChat; text?: string; photo?: TelegramPhoto[] };
type TelegramCallback = { id: string; from: TelegramUser; data?: string; message?: TelegramMessage };
type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallback };

type FlowData = {
  name?: string;
  categoryId?: string;
  categoryName?: string;
  colors?: string[];
  storageOptions?: string[];
  price?: number;
  details?: string;
  images?: string[];
};

type FlowStep =
  | 'section_name'
  | 'rename_section'
  | 'product_name'
  | 'product_colors'
  | 'product_storage'
  | 'product_price'
  | 'product_details'
  | 'product_images';

type AdminSession = {
  telegramUserId: number;
  chatId: number;
  workflow: 'add_section' | 'rename_section' | 'add_product';
  step: FlowStep;
  data: FlowData;
  updatedAt: Date;
};

const MENU_ORDERS = 'طلبات العملاء';
const MENU_ADD_SECTION = 'إضافة طلب';
const MENU_EDIT_SECTION = 'تعديل الطلبات';
const MENU_ADD_PRODUCT = 'إضافة منتج';
const MAIN_MENU_TEXT = 'رجوع إلى القائمة الرئيسية';
const SAVE_PRODUCT_TEXT = 'حفظ المنتج';
const CANCEL_TEXT = '/cancel';

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

function isObjectId(value: string) {
  return ObjectId.isValid(value) && new ObjectId(value).toHexString() === value.toLowerCase();
}

function orderStatusLabel(status: unknown) {
  return typeof status === 'string' && status in ORDER_STATUS_LABELS
    ? ORDER_STATUS_LABELS[status as OrderStatus]
    : 'غير محدد';
}

function normalizeAmount(value: string) {
  const arabicDigits = value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  return Number(arabicDigits.replace(/[٬,\s]/g, '').replace(/[^\d.]/g, ''));
}

function parseList(value: string) {
  return [...new Set(value.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

async function unreadOrderCount(db: Db) {
  return db.collection('orders').countDocuments({ source: 'website', adminSeenAt: null });
}

async function sendMainMenu(db: Db, chatId: number, message = 'أهلًا بك في لوحة إدارة أرض الجوال. اختر القسم المطلوب:') {
  await ensureDefaultCategories(db);
  const count = await unreadOrderCount(db);
  await sendTelegramMessage(chatId, message, { reply_markup: adminReplyKeyboard(count) });
}

async function saveSession(db: Db, session: AdminSession) {
  session.updatedAt = new Date();
  await db.collection<AdminSession>('telegram_sessions').updateOne(
    { telegramUserId: session.telegramUserId },
    { $set: session },
    { upsert: true }
  );
}

async function startFlow(db: Db, userId: number, chatId: number, workflow: AdminSession['workflow'], step: FlowStep, data: FlowData, prompt: string) {
  const session: AdminSession = { telegramUserId: userId, chatId, workflow, step, data, updatedAt: new Date() };
  await saveSession(db, session);
  await sendTelegramMessage(chatId, prompt, {
    reply_markup: { keyboard: [[{ text: MAIN_MENU_TEXT }]], resize_keyboard: true, one_time_keyboard: false }
  });
}

async function showCustomerOrders(db: Db, chatId: number) {
  const unseenOrders = await db.collection<StoreOrder>('orders')
    .find({ source: 'website', adminSeenAt: null })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  const orders = unseenOrders.length ? unseenOrders : await getRecentOrders(db, 10);

  if (!orders.length) {
    await sendTelegramMessage(chatId, '🔔 لا توجد طلبات عملاء حتى الآن.', { reply_markup: adminReplyKeyboard(0) });
    return;
  }

  const summary = orders.map((order) => {
    const customer = order.customer || { name: 'بدون اسم', phone: '—', address: '—' };
    const total = Number(order.total || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
    return [
      `طلب ${order.orderNumber || order._id.toHexString()}`,
      `الاسم: ${customer.name || '—'}`,
      `الجوال: ${customer.phone || '—'}`,
      `الإجمالي: ${total} ر.س`,
      `الحالة: ${orderStatusLabel(order.status)}`
    ].join('\n');
  }).join('\n\n──────────────\n\n');

  const keyboard = {
    inline_keyboard: orders.map((order) => [{
      text: `${order.orderNumber} · ${orderStatusLabel(order.status)}`.slice(0, 60),
      callback_data: `edit-order:${order._id.toHexString()}`
    }])
  };
  await sendTelegramMessage(chatId, `🧾 ${unseenOrders.length ? 'الطلبات الجديدة غير المقروءة' : 'آخر الطلبات'} (${orders.length})\n\n${summary}\n\nاضغط على رقم طلب لو عايز تعرض تفاصيله وتغيّر حالته.`, {
    reply_markup: keyboard
  });

  const displayedWebsiteOrderIds = orders
    .filter((order) => order.source === 'website')
    .map((order) => order._id);
  if (displayedWebsiteOrderIds.length) {
    await db.collection('orders').updateMany(
      { _id: { $in: displayedWebsiteOrderIds }, source: 'website', adminSeenAt: null },
      { $set: { adminSeenAt: new Date() } }
    );
  }
  await sendMainMenu(db, chatId, 'تم عرض الطلبات. تم تحديث عدّاد الطلبات التي شاهدتها.');
}

async function listSectionsForEdit(db: Db, chatId: number) {
  await ensureDefaultCategories(db);
  const sections = await db.collection<StoreCategory>('categories').find({}).sort({ name: 1 }).limit(80).toArray();
  if (!sections.length) {
    await sendMainMenu(db, chatId, 'لا توجد أقسام لتعديلها.');
    return;
  }
  await sendTelegramMessage(chatId, 'اختر القسم الذي تريد تعديل اسمه فقط:', {
    reply_markup: {
      inline_keyboard: sections.map((section) => [{
        text: section.name.slice(0, 60),
        callback_data: `rename-section:${section._id.toHexString()}`
      }])
    }
  });
}

async function listSectionsForProduct(db: Db, chatId: number, userId: number) {
  await ensureDefaultCategories(db);
  const sections = await db.collection<StoreCategory>('categories').find({}).sort({ name: 1 }).limit(80).toArray();
  if (!sections.length) {
    await sendMainMenu(db, chatId, 'لا توجد أقسام. استخدم «إضافة طلب» لإنشاء قسم بالاسم أولًا.');
    return;
  }

  await sendTelegramMessage(chatId, 'اختر قسم المنتج:', {
    reply_markup: {
      inline_keyboard: sections.map((section) => [{
        text: section.name.slice(0, 60),
        callback_data: `product-section:${section._id.toHexString()}`
      }])
    }
  });
}

async function listOrdersForEditing(db: Db, chatId: number, orderId: string) {
  if (!isObjectId(orderId)) {
    await sendTelegramMessage(chatId, 'معرّف الطلب غير صالح.');
    return;
  }
  const order = await db.collection<StoreOrder>('orders').findOne({ _id: new ObjectId(orderId) });
  if (!order) {
    await sendTelegramMessage(chatId, 'لم يتم العثور على الطلب.');
    return;
  }
  await sendTelegramMessage(chatId, `تفاصيل الطلب\n\n${formatOrderForAdmin(order as unknown as Record<string, unknown>)}\n\nاختر حالة الطلب:`, {
    reply_markup: statusInlineKeyboard(orderId)
  });
}

async function handleCallback(db: Db, callback: TelegramCallback) {
  await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
  const chatId = callback.message?.chat.id;
  if (!chatId || !callback.data) return;

  const [action, id, status] = callback.data.split(':');

  if (action === 'product-section') {
    if (!isObjectId(id || '')) {
      await sendTelegramMessage(chatId, 'القسم المحدد غير صالح.');
      return;
    }
    const section = await db.collection<StoreCategory>('categories').findOne({ _id: new ObjectId(id) });
    if (!section) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على القسم. أعد فتح «إضافة منتج».');
      return;
    }
    await startFlow(db, callback.from.id, chatId, 'add_product', 'product_name', {
      categoryId: section._id.toHexString(),
      categoryName: section.name,
      images: []
    }, `القسم: ${section.name}\n\nاكتب اسم المنتج.`);
    return;
  }

  if (action === 'rename-section') {
    if (!isObjectId(id || '')) {
      await sendTelegramMessage(chatId, 'القسم المحدد غير صالح.');
      return;
    }
    const section = await db.collection<StoreCategory>('categories').findOne({ _id: new ObjectId(id) });
    if (!section) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على القسم.');
      return;
    }
    await startFlow(db, callback.from.id, chatId, 'rename_section', 'rename_section', {
      categoryId: section._id.toHexString(),
      categoryName: section.name
    }, `القسم الحالي: ${section.name}\n\nاكتب الاسم الجديد فقط.`);
    return;
  }

  if (action === 'edit-order') {
    await listOrdersForEditing(db, chatId, id || '');
    return;
  }

  if (action === 'status' && id && status && status in ORDER_STATUS_LABELS && isObjectId(id)) {
    const nextStatus = status as OrderStatus;
    const result = await db.collection<StoreOrder>('orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: nextStatus, updatedAt: new Date(), updatedByTelegramId: callback.from.id } }
    );
    if (!result.matchedCount) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على الطلب لتحديثه.');
      return;
    }
    const order = await db.collection<StoreOrder>('orders').findOne({ _id: new ObjectId(id) });
    await sendTelegramMessage(chatId, `✅ تم تعديل حالة الطلب ${order?.orderNumber || id}\nالحالة الجديدة: ${ORDER_STATUS_LABELS[nextStatus]}.`);
    await sendMainMenu(db, chatId);
    return;
  }

  await sendTelegramMessage(chatId, 'الأمر غير معروف. ارجع للقائمة الرئيسية.');
}

async function saveCategory(db: Db, name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 80) throw new Error('اسم القسم يجب أن يكون من حرفين إلى 80 حرفًا.');
  const sections = await db.collection<StoreCategory>('categories').find({}).toArray();
  const duplicate = sections.some((section) => section.name.trim().toLocaleLowerCase('ar') === normalized.toLocaleLowerCase('ar'));
  if (duplicate) throw new Error('يوجد قسم بهذا الاسم بالفعل.');
  const now = new Date();
  await db.collection('categories').insertOne({ name: normalized, description: '', createdAt: now, updatedAt: now });
}

async function saveProduct(db: Db, session: AdminSession, chatId: number) {
  const data = session.data;
  if (!data.categoryId || !data.categoryName || !data.name || !data.price || !data.details || !data.images?.length) {
    await sendTelegramMessage(chatId, 'بعض بيانات المنتج ناقصة. اكتب /cancel للإلغاء ثم أعد المحاولة.');
    return false;
  }
  const section = await db.collection<StoreCategory>('categories').findOne({ _id: new ObjectId(data.categoryId) });
  if (!section) {
    await sendTelegramMessage(chatId, 'القسم لم يعد موجودًا. ابدأ «إضافة منتج» من جديد.');
    return false;
  }
  const now = new Date();
  const result = await db.collection<StoredProduct>('products').insertOne({
    categoryId: section._id.toHexString(),
    category: section.name,
    name: data.name,
    colors: data.colors || [],
    storageOptions: data.storageOptions || [],
    price: data.price,
    details: data.details,
    images: data.images.slice(0, 10),
    createdAt: now,
    updatedAt: now
  } as Omit<StoredProduct, '_id'>);

  await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
  await sendTelegramMessage(chatId, `✅ تم حفظ المنتج بنجاح\n\nاسم المنتج: ${data.name}\nالقسم: ${section.name}\nالألوان: ${(data.colors || []).join('، ') || 'غير محدد'}\nمساحات التخزين: ${(data.storageOptions || []).join('، ') || 'غير محدد'}\nالسعر: ${Number(data.price).toLocaleString('ar-SA')} ر.س\nعدد الصور: ${data.images.length}\n\nسيظهر في القسم على المتجر خلال تحديث بيانات المنصة.`, {
    reply_markup: adminReplyKeyboard(await unreadOrderCount(db))
  });
  return Boolean(result.insertedId);
}

async function handleImageStep(db: Db, session: AdminSession, message: TelegramMessage) {
  const chatId = message.chat.id;
  if (message.photo?.length) {
    const best = message.photo[message.photo.length - 1];
    session.data.images = [...(session.data.images || []), best.file_id].slice(0, 10);
    await saveSession(db, session);
    await sendTelegramMessage(chatId, `وصلت الصورة رقم ${session.data.images.length} من 10. أرسل صورًا أخرى أو اضغط «حفظ المنتج» عند الانتهاء.`, {
      reply_markup: {
        keyboard: [[{ text: SAVE_PRODUCT_TEXT }], [{ text: MAIN_MENU_TEXT }]],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });
    return;
  }

  const text = message.text?.trim() || '';
  if (text === SAVE_PRODUCT_TEXT || text === '/done') {
    if (!session.data.images?.length) {
      await sendTelegramMessage(chatId, 'أرسل صورة واحدة على الأقل قبل حفظ المنتج.');
      return;
    }
    await saveProduct(db, session, chatId);
    return;
  }

  await sendTelegramMessage(chatId, 'أرسل صورة المنتج من تيليجرام. يمكنك إرسال عدة صور، ثم اضغط «حفظ المنتج».');
}

async function handleFlowMessage(db: Db, session: AdminSession, message: TelegramMessage) {
  const chatId = message.chat.id;
  const text = message.text?.trim() || '';
  if (session.step === 'product_images') {
    await handleImageStep(db, session, message);
    return;
  }
  if (!text) {
    await sendTelegramMessage(chatId, 'أرسل النص المطلوب في هذه الخطوة أو /cancel للإلغاء.');
    return;
  }

  if (session.workflow === 'add_section' && session.step === 'section_name') {
    try {
      await saveCategory(db, text);
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
      await sendMainMenu(db, chatId, `✅ تم حفظ القسم «${text.trim()}» بالاسم فقط. سيظهر ضمن أقسام اختيار المنتج.`);
    } catch (error) {
      await sendTelegramMessage(chatId, error instanceof Error ? error.message : 'تعذر حفظ القسم.');
    }
    return;
  }

  if (session.workflow === 'rename_section' && session.step === 'rename_section') {
    const categoryId = session.data.categoryId || '';
    if (!isObjectId(categoryId)) {
      await sendTelegramMessage(chatId, 'تعذر تحديد القسم. ارجع إلى القائمة وحاول مجددًا.');
      return;
    }
    const normalized = text.replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > 80) {
      await sendTelegramMessage(chatId, 'الاسم يجب أن يكون من حرفين إلى 80 حرفًا.');
      return;
    }
    const otherSections = await db.collection<StoreCategory>('categories').find({ _id: { $ne: new ObjectId(categoryId) } }).toArray();
    const duplicateName = otherSections.some((section) => section.name.trim().toLocaleLowerCase('ar') === normalized.toLocaleLowerCase('ar'));
    if (duplicateName) {
      await sendTelegramMessage(chatId, 'يوجد قسم آخر بهذا الاسم. اكتب اسمًا مختلفًا.');
      return;
    }
    const updated = await db.collection<StoreCategory>('categories').findOneAndUpdate(
      { _id: new ObjectId(categoryId) },
      { $set: { name: normalized, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على القسم.');
      return;
    }
    await db.collection('products').updateMany(
      { categoryId },
      { $set: { category: normalized, updatedAt: new Date() } }
    );
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendMainMenu(db, chatId, `✅ تم تعديل اسم القسم إلى «${normalized}». تم تحديث الاسم في المنتجات التابعة له.`);
    return;
  }

  if (session.workflow === 'add_product') {
    if (session.step === 'product_name') {
      if (text.length < 2 || text.length > 120) {
        await sendTelegramMessage(chatId, 'اسم المنتج يجب أن يكون من حرفين إلى 120 حرفًا.');
        return;
      }
      session.data.name = text;
      session.step = 'product_colors';
      await saveSession(db, session);
      await sendTelegramMessage(chatId, 'اكتب الألوان المتاحة مفصولة بفاصلة، مثال: أسود، أبيض، أزرق. إذا لا توجد ألوان مختلفة اكتب «تخطي».');
      return;
    }
    if (session.step === 'product_colors') {
      session.data.colors = text === 'تخطي' ? [] : parseList(text);
      session.step = 'product_storage';
      await saveSession(db, session);
      await sendTelegramMessage(chatId, 'اكتب مساحات التخزين المتاحة، مثال: 128GB، 256GB، 512GB. إذا لا ينطبق اكتب «تخطي».');
      return;
    }
    if (session.step === 'product_storage') {
      session.data.storageOptions = text === 'تخطي' ? [] : parseList(text);
      session.step = 'product_price';
      await saveSession(db, session);
      await sendTelegramMessage(chatId, 'اكتب سعر المنتج بالريال السعودي، رقمًا فقط. مثال: 6099 أو 6099.50.');
      return;
    }
    if (session.step === 'product_price') {
      const price = normalizeAmount(text);
      if (!Number.isFinite(price) || price <= 0 || price > 100000000) {
        await sendTelegramMessage(chatId, 'السعر غير صحيح. اكتب مبلغًا أكبر من صفر.');
        return;
      }
      session.data.price = price;
      session.step = 'product_details';
      await saveSession(db, session);
      await sendTelegramMessage(chatId, 'اكتب تفاصيل المنتج ومواصفاته.');
      return;
    }
    if (session.step === 'product_details') {
      if (text.length < 2 || text.length > 3000) {
        await sendTelegramMessage(chatId, 'تفاصيل المنتج يجب أن تكون من حرفين إلى 3000 حرف.');
        return;
      }
      session.data.details = text;
      session.step = 'product_images';
      session.data.images = [];
      await saveSession(db, session);
      await sendTelegramMessage(chatId, 'أرسل صورة المنتج الآن. يمكنك إرسال عدة صور متتالية، ثم اضغط «حفظ المنتج».', {
        reply_markup: {
          keyboard: [[{ text: SAVE_PRODUCT_TEXT }], [{ text: MAIN_MENU_TEXT }]],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      });
      return;
    }
  }

  await sendTelegramMessage(chatId, 'تعذر متابعة الخطوة الحالية. اكتب /cancel ثم ابدأ من القائمة.');
}

async function handleUpdate(db: Db, update: TelegramUpdate) {
  if (update.callback_query) {
    const callback = update.callback_query;
    if (!isAuthorized(callback.from.id)) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: 'غير مصرح لك بالإدارة.', show_alert: true });
      return;
    }
    await handleCallback(db, callback);
    return;
  }

  const message = update.message;
  const from = message?.from;
  const chatId = message?.chat.id;
  const text = message?.text?.trim();
  if (!message || !from || !chatId) return;
  if (message.chat.type !== 'private' || chatId !== from.id) return;
  if (!isAuthorized(from.id)) return;

  if (text === '/start' || text === '/menu' || text === MAIN_MENU_TEXT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await sendMainMenu(db, chatId);
    return;
  }
  if (text === CANCEL_TEXT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await sendMainMenu(db, chatId, 'تم إلغاء العملية الحالية.');
    return;
  }

  const normalizedText = (text || '').replace(/^🔔\s*/, '').replace(/\s*\(\d+\+?\)$/, '');
  if (normalizedText === MENU_ORDERS) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await showCustomerOrders(db, chatId);
    return;
  }
  if (text === MENU_ADD_SECTION) {
    await startFlow(db, from.id, chatId, 'add_section', 'section_name', {}, 'إضافة قسم/طلب جديد\n\nأرسل الاسم فقط. سيظهر هذا الاسم في قائمة أقسام المنتجات. اكتب /cancel للإلغاء.');
    return;
  }
  if (text === MENU_EDIT_SECTION) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await listSectionsForEdit(db, chatId);
    return;
  }
  if (text === MENU_ADD_PRODUCT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await listSectionsForProduct(db, chatId, from.id);
    return;
  }

  const session = await db.collection<AdminSession>('telegram_sessions').findOne({ telegramUserId: from.id });
  if (session) {
    if (Date.now() - new Date(session.updatedAt).getTime() > 30 * 60 * 1000) {
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
      await sendMainMenu(db, chatId, 'انتهت المهلة. ابدأ العملية مرة أخرى من القائمة.');
      return;
    }
    await handleFlowMessage(db, session, message);
    return;
  }

  await sendMainMenu(db, chatId, 'استخدم أزرار القائمة لإدارة المتجر.');
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
    await ensureDefaultCategories(db);
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
