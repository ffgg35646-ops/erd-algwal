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
import { formatOrderForAdmin, getRecentOrders, type StoreOrder } from '@/lib/orders';

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
  productId?: string;
  colors?: string[];
  storageOptions?: string[];
  price?: number;
  details?: string;
  images?: string[];
  orderId?: string;
  bannerId?: string;
  footerKey?: string;
  footerSettingKey?: 'vat' | 'barcode';
  content?: string;
};

type FlowStep =
  | 'section_name' | 'rename_section'
  | 'product_name' | 'product_colors' | 'product_storage' | 'product_price' | 'product_details' | 'product_images'
  | 'edit_product_name' | 'edit_product_colors' | 'edit_product_storage' | 'edit_product_price' | 'edit_product_details' | 'edit_product_images'
  | 'contact_whatsapp' | 'cancel_reason' | 'slider_image' | 'footer_edit_text' | 'footer_confirm_save'
  | 'footer_vat_number' | 'footer_barcode_image';

type AdminSession = {
  telegramUserId: number;
  chatId: number;
  workflow: 'add_section' | 'rename_section' | 'add_product' | 'edit_product' | 'contact' | 'cancel_order' | 'slider' | 'footer_content' | 'footer_settings';
  step: FlowStep;
  data: FlowData;
  updatedAt: Date;
};

const MENU_ORDERS = 'طلبات العملاء';
const MENU_ADD_SECTION = 'إضافة قسم';
const MENU_EDIT_SECTION = 'تعديل قسم';
const MENU_ADD_PRODUCT = 'إضافة منتج';
const MENU_EDIT_PRODUCT = 'تعديل المنتج';
const MENU_CONTACT = 'الاتصال';
const MENU_SLIDER = 'السلايدر';
const MENU_POLICIES = 'السياسات';
const MENU_CUSTOMER_SERVICE = 'خدمات العملاء';
const MENU_FOOTER_SETTINGS = 'تعديلات أخرى';
const SAVE_FOOTER_TEXT = 'حفظ النص';
const REWRITE_FOOTER_TEXT = 'إعادة الكتابة';
const MAIN_MENU_TEXT = 'رجوع إلى القائمة الرئيسية';
const SAVE_PRODUCT_TEXT = 'حفظ المنتج';

const PRODUCT_COLOR_OPTIONS = [
  { key: 'black', name: 'أسود', icon: '⚫' },
  { key: 'white', name: 'أبيض', icon: '⚪' },
  { key: 'red', name: 'أحمر', icon: '🔴' },
  { key: 'yellow', name: 'أصفر', icon: '🟡' },
  { key: 'blue', name: 'أزرق', icon: '🔵' },
  { key: 'green', name: 'أخضر', icon: '🟢' },
  { key: 'purple', name: 'بنفسجي', icon: '🟣' },
  { key: 'pink', name: 'وردي', icon: '🩷' },
  { key: 'brown', name: 'بني', icon: '🟤' },
  { key: 'orange', name: 'برتقالي', icon: '🟠' },
  { key: 'gray', name: 'رمادي', icon: '🩶' },
  { key: 'gold', name: 'ذهبي', icon: '🟨' },
  { key: 'silver', name: 'فضي', icon: '🔘' },
  { key: 'natural-titanium', name: 'تيتانيوم طبيعي', icon: '◻️' }
] as const;
const CANCEL_TEXT = '/cancel';

const FOOTER_PAGE_DEFINITIONS: Record<string, { title: string; group: 'policies' | 'customer-service' }> = {
  privacy: { title: 'سياسة الخصوصية', group: 'policies' },
  terms: { title: 'الشروط والأحكام', group: 'policies' },
  returns: { title: 'الاستبدال والاسترجاع', group: 'policies' },
  shipping: { title: 'الشحن والتوصيل', group: 'customer-service' },
  'payment-methods': { title: 'طرق الدفع', group: 'customer-service' },
  ordering: { title: 'طلب الدفع والشراء', group: 'customer-service' },
  faq: { title: 'الأسئلة الشائعة', group: 'customer-service' }
};

type StoreBannerRecord = {
  _id: ObjectId;
  fileId?: string;
  imageUrl?: string;
  alt?: string;
  createdAt: Date;
  createdByTelegramId?: number;
  createdBySystem?: boolean;
};

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

function normalizeAmount(value: string) {
  const arabicDigits = value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  return Number(arabicDigits.replace(/[٬,\s]/g, '').replace(/[^\d.]/g, ''));
}

function parseList(value: string) {
  return [...new Set(value.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

function digits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\D/g, '');
}

function normalizeWhatsAppNumber(value: string) {
  let phone = digits(value);
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('01') && phone.length === 11) phone = '20' + phone.slice(1);
  else if (phone.startsWith('05') && phone.length === 10) phone = '966' + phone.slice(1);
  else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;
  if (phone.length < 8 || phone.length > 15) return '';
  return phone;
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

async function startFlow(
  db: Db,
  userId: number,
  chatId: number,
  workflow: AdminSession['workflow'],
  step: FlowStep,
  data: FlowData,
  prompt: string,
  keyboard?: Record<string, unknown>
) {
  await saveSession(db, { telegramUserId: userId, chatId, workflow, step, data, updatedAt: new Date() });
  await sendTelegramMessage(chatId, prompt, {
    reply_markup: keyboard || { keyboard: [[{ text: MAIN_MENU_TEXT }]], resize_keyboard: true, one_time_keyboard: false }
  });
}

function categoryButtons(sections: StoreCategory[], prefix: string) {
  return {
    inline_keyboard: [
      ...sections.map((section) => [{
        text: section.name.slice(0, 60),
        callback_data: prefix + ':' + section._id.toHexString()
      }]),
      [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
    ]
  };
}

async function listSectionsForEdit(db: Db, chatId: number) {
  await ensureDefaultCategories(db);
  const sections = await db.collection<StoreCategory>('categories').find({}).sort({ name: 1 }).limit(80).toArray();
  if (!sections.length) {
    await sendMainMenu(db, chatId, 'لا توجد أقسام لتعديلها.');
    return;
  }
  await sendTelegramMessage(chatId, 'اختر القسم الذي تريد تعديل اسمه فقط:', {
    reply_markup: categoryButtons(sections, 'rename-section')
  });
}

async function listSectionsForProduct(db: Db, chatId: number) {
  await ensureDefaultCategories(db);
  const sections = await db.collection<StoreCategory>('categories').find({}).sort({ name: 1 }).limit(80).toArray();
  if (!sections.length) {
    await sendMainMenu(db, chatId, 'لا توجد أقسام. استخدم «إضافة قسم» لإنشاء قسم أولًا.');
    return;
  }
  await sendTelegramMessage(chatId, 'اختر القسم الذي سيُضاف إليه المنتج:', {
    reply_markup: categoryButtons(sections, 'product-section')
  });
}

async function listProductsForEdit(db: Db, chatId: number) {
  const products = await db.collection<StoredProduct>('products').find({}).sort({ updatedAt: -1 }).limit(80).toArray();
  if (!products.length) {
    await sendMainMenu(db, chatId, 'لا توجد منتجات مضافة من البوت حتى الآن.');
    return;
  }
  await sendTelegramMessage(chatId, 'اختر المنتج الذي تريد تعديله أو حذفه:', {
    reply_markup: {
      inline_keyboard: [
        ...products.map((product) => [{
          text: (product.name + ' — ' + product.price.toLocaleString('ar-SA') + ' ر.س').slice(0, 60),
          callback_data: 'edit-product:' + product._id.toHexString()
        }]),
        [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
      ]
    }
  });
}

function productColorKeyboard(selectedColors: string[] = []) {
  const options = PRODUCT_COLOR_OPTIONS.map((option) => ({
    text: (selectedColors.includes(option.name) ? '✓ ' : '') + option.icon + ' ' + option.name,
    callback_data: 'product-color:toggle:' + option.key
  }));
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let index = 0; index < options.length; index += 2) {
    rows.push(options.slice(index, index + 2));
  }
  rows.push([
    { text: '🧹 مسح الاختيار', callback_data: 'product-color:clear' },
    { text: '✅ حفظ الألوان', callback_data: 'product-color:done' }
  ]);
  rows.push([{ text: '↩ القائمة الرئيسية', callback_data: 'main-menu' }]);
  return { inline_keyboard: rows };
}

function productColorPrompt(selectedColors: string[] = []) {
  return '🎨 اختر الألوان المتوفرة للمنتج بالضغط على دوائر الألوان. يمكنك تحديد أكثر من لون، ثم اضغط «حفظ الألوان».\n\nالألوان المختارة: ' + (selectedColors.join('، ') || 'لم يتم اختيار ألوان بعد.');
}

async function refreshProductColorMessage(chatId: number, messageId: number | undefined, selectedColors: string[]) {
  if (messageId) {
    try {
      await telegramApi('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: productColorPrompt(selectedColors),
        reply_markup: productColorKeyboard(selectedColors)
      });
      return;
    } catch (error) {
      console.error('Could not refresh product color picker:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  await sendTelegramMessage(chatId, productColorPrompt(selectedColors), { reply_markup: productColorKeyboard(selectedColors) });
}

function editProductKeyboard(id: string) {
  return {
    inline_keyboard: [
      [{ text: 'القسم', callback_data: 'product-field:' + id + ':category' }, { text: 'اسم المنتج', callback_data: 'product-field:' + id + ':name' }],
      [{ text: 'الألوان', callback_data: 'product-field:' + id + ':colors' }, { text: 'مساحة التخزين', callback_data: 'product-field:' + id + ':storage' }],
      [{ text: 'السعر', callback_data: 'product-field:' + id + ':price' }, { text: 'تفاصيل المنتج', callback_data: 'product-field:' + id + ':details' }],
      [{ text: 'الصور (استبدال الصور)', callback_data: 'product-field:' + id + ':images' }],
      [{ text: '🗑 حذف المنتج', callback_data: 'delete-product:' + id }],
      [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
    ]
  };
}

async function showProductEditMenu(db: Db, chatId: number, id: string) {
  if (!isObjectId(id)) {
    await sendTelegramMessage(chatId, 'معرّف المنتج غير صالح.');
    return;
  }
  const product = await db.collection<StoredProduct>('products').findOne({ _id: new ObjectId(id) });
  if (!product) {
    await sendTelegramMessage(chatId, 'لم يتم العثور على المنتج.');
    return;
  }
  const message = [
    'تعديل المنتج',
    '',
    'الاسم: ' + product.name,
    'القسم: ' + product.category,
    'الألوان: ' + ((product.colors || []).join('، ') || 'غير محدد'),
    'مساحات التخزين: ' + ((product.storageOptions || []).join('، ') || 'غير محدد'),
    'السعر: ' + product.price.toLocaleString('ar-SA') + ' ر.س',
    'عدد الصور: ' + (product.images || []).length,
    '',
    'اختر الخانة التي تريد تعديلها. زر الحذف موجود بالأسفل.'
  ].join('\n');
  await sendTelegramMessage(chatId, message, { reply_markup: editProductKeyboard(id) });
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
      'طلب ' + (order.orderNumber || order._id.toHexString()),
      'الاسم: ' + (customer.name || '—'),
      'الجوال: ' + (customer.phone || '—'),
      'الإجمالي: ' + total + ' ر.س',
      'الحالة: ' + (typeof order.status === 'string' && order.status in ORDER_STATUS_LABELS ? ORDER_STATUS_LABELS[order.status as OrderStatus] : 'غير محدد')
    ].join('\n');
  }).join('\n\n──────────────\n\n');
  const keyboard = {
    inline_keyboard: [
      ...orders.map((order) => [{
        text: ((order.orderNumber || 'طلب') + ' · ' + (ORDER_STATUS_LABELS[order.status as OrderStatus] || 'غير محدد')).slice(0, 60),
        callback_data: 'edit-order:' + order._id.toHexString()
      }]),
      [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
    ]
  };
  await sendTelegramMessage(chatId, '🧾 ' + (unseenOrders.length ? 'الطلبات الجديدة غير المقروءة' : 'آخر الطلبات') + ' (' + orders.length + ')\n\n' + summary + '\n\nاضغط على رقم طلب لعرض تفاصيله وتغيير حالته.', { reply_markup: keyboard });
  const ids = orders.filter((order) => order.source === 'website').map((order) => order._id);
  if (ids.length) {
    await db.collection('orders').updateMany({ _id: { $in: ids }, source: 'website', adminSeenAt: null }, { $set: { adminSeenAt: new Date() } });
  }
  await sendMainMenu(db, chatId, 'تم عرض الطلبات التي ظهرت في القائمة.');
}

async function listOrderDetails(db: Db, chatId: number, id: string) {
  if (!isObjectId(id)) return sendTelegramMessage(chatId, 'معرّف الطلب غير صالح.');
  const order = await db.collection<StoreOrder>('orders').findOne({ _id: new ObjectId(id) });
  if (!order) return sendTelegramMessage(chatId, 'لم يتم العثور على الطلب.');
  await sendTelegramMessage(chatId, 'تفاصيل الطلب\n\n' + formatOrderForAdmin(order as unknown as Record<string, unknown>) + '\n\nاختر حالة الطلب:', {
    reply_markup: {
      inline_keyboard: [
        ...statusInlineKeyboard(id).inline_keyboard,
        [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
      ]
    }
  });
}

async function saveCategory(db: Db, name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 80) throw new Error('اسم القسم يجب أن يكون من حرفين إلى 80 حرفًا.');
  const sections = await db.collection<StoreCategory>('categories').find({}).toArray();
  if (sections.some((section) => section.name.trim().toLocaleLowerCase('ar') === normalized.toLocaleLowerCase('ar'))) {
    throw new Error('يوجد قسم بهذا الاسم بالفعل.');
  }
  const now = new Date();
  await db.collection('categories').insertOne({ name: normalized, description: '', createdAt: now, updatedAt: now });
}

async function saveProduct(db: Db, session: AdminSession, chatId: number) {
  const data = session.data;
  if (!data.images?.length) {
    await sendTelegramMessage(chatId, 'أرسل صورة واحدة على الأقل قبل حفظ المنتج.');
    return false;
  }
  const now = new Date();

  if (session.workflow === 'edit_product') {
    if (!isObjectId(data.productId || '')) {
      await sendTelegramMessage(chatId, 'معرّف المنتج غير صالح.');
      return false;
    }
    const result = await db.collection<StoredProduct>('products').updateOne(
      { _id: new ObjectId(data.productId) },
      { $set: { images: data.images.slice(0, 10), updatedAt: now } }
    );
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendTelegramMessage(chatId, result.matchedCount ? '✅ تم تحديث صور المنتج.' : 'لم يتم العثور على المنتج.');
    await sendMainMenu(db, chatId);
    return result.matchedCount > 0;
  }

  if (!data.categoryId || !data.categoryName || !data.name || !data.price || !data.details) {
    await sendTelegramMessage(chatId, 'بعض بيانات المنتج ناقصة. اكتب /cancel للإلغاء ثم أعد المحاولة.');
    return false;
  }
  const section = await db.collection<StoreCategory>('categories').findOne({ _id: new ObjectId(data.categoryId) });
  if (!section) {
    await sendTelegramMessage(chatId, 'القسم لم يعد موجودًا. ابدأ «إضافة منتج» من جديد.');
    return false;
  }
  const productId = new ObjectId();
  const result = await db.collection<StoredProduct>('products').insertOne({
    _id: productId,
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
  });
  await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
  await sendTelegramMessage(chatId, result.insertedId
    ? '✅ تم حفظ المنتج بنجاح\n\nاسم المنتج: ' + data.name + '\nالقسم: ' + section.name + '\nالألوان: ' + ((data.colors || []).join('، ') || 'غير محدد') + '\nمساحات التخزين: ' + ((data.storageOptions || []).join('، ') || 'غير محدد') + '\nالسعر: ' + data.price.toLocaleString('ar-SA') + ' ر.س\nعدد الصور: ' + data.images.length + '\n\nسيظهر على الموقع بعد تحديث الكتالوج.'
    : 'تعذر حفظ المنتج.', { reply_markup: adminReplyKeyboard(await unreadOrderCount(db)) });
  return Boolean(result.insertedId);
}

async function handleImageStep(db: Db, session: AdminSession, message: TelegramMessage) {
  const chatId = message.chat.id;
  if (message.photo?.length) {
    const best = message.photo[message.photo.length - 1];
    session.data.images = [...(session.data.images || []), best.file_id].slice(0, 10);
    await saveSession(db, session);
    await sendTelegramMessage(chatId, 'وصلت الصورة رقم ' + session.data.images.length + ' من 10. أرسل صورًا أخرى أو اضغط «حفظ المنتج» عند الانتهاء.', {
      reply_markup: { keyboard: [[{ text: SAVE_PRODUCT_TEXT }], [{ text: MAIN_MENU_TEXT }]], resize_keyboard: true, one_time_keyboard: false }
    });
    return;
  }
  const text = message.text?.trim() || '';
  if (text === SAVE_PRODUCT_TEXT || text === '/done') {
    if (!session.data.images?.length) {
      await sendTelegramMessage(chatId, 'أرسل صورة واحدة على الأقل قبل الحفظ.');
      return;
    }
    await saveProduct(db, session, chatId);
    return;
  }
  await sendTelegramMessage(chatId, 'أرسل صورة المنتج. يمكنك إرسال عدة صور، ثم اضغط «حفظ المنتج».');
}

async function saveEditedField(db: Db, session: AdminSession, value: string, chatId: number) {
  const id = session.data.productId || '';
  if (!isObjectId(id)) {
    await sendTelegramMessage(chatId, 'معرّف المنتج غير صالح.');
    return;
  }
  let update: Record<string, unknown> = {};
  if (session.step === 'edit_product_name') {
    if (value.length < 2 || value.length > 120) return void await sendTelegramMessage(chatId, 'اسم المنتج يجب أن يكون من حرفين إلى 120 حرفًا.');
    update = { name: value };
  } else if (session.step === 'edit_product_colors') {
    update = { colors: value === 'تخطي' ? [] : parseList(value) };
  } else if (session.step === 'edit_product_storage') {
    update = { storageOptions: value === 'تخطي' ? [] : parseList(value) };
  } else if (session.step === 'edit_product_price') {
    const price = normalizeAmount(value);
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) return void await sendTelegramMessage(chatId, 'السعر غير صحيح. أرسل رقمًا أكبر من صفر.');
    update = { price };
  } else if (session.step === 'edit_product_details') {
    if (value.length < 2 || value.length > 3000) return void await sendTelegramMessage(chatId, 'التفاصيل يجب أن تكون من حرفين إلى 3000 حرف.');
    update = { details: value };
  } else {
    await sendTelegramMessage(chatId, 'حقل التعديل غير معروف.');
    return;
  }

  const result = await db.collection<StoredProduct>('products').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: new Date() } }
  );
  await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
  if (!result.matchedCount) {
    await sendMainMenu(db, chatId, 'لم يتم العثور على المنتج.');
    return;
  }
  await showProductEditMenu(db, chatId, id);
}


async function updateOrderStatus(
  db: Db,
  chatId: number,
  telegramUserId: number,
  orderId: string,
  nextStatus: OrderStatus,
  cancellationReason = ''
) {
  if (!isObjectId(orderId)) {
    await sendTelegramMessage(chatId, 'معرّف الطلب غير صالح.');
    return;
  }

  const orders = db.collection<StoreOrder>('orders');
  const order = await orders.findOne({ _id: new ObjectId(orderId) });
  if (!order) {
    await sendTelegramMessage(chatId, 'لم يتم العثور على الطلب.');
    return;
  }

  const reason = nextStatus === 'cancelled' ? cancellationReason.trim().slice(0, 500) : '';
  const statusChanged = order.status !== nextStatus
    || (nextStatus === 'cancelled' && String(order.cancellationReason || '') !== reason);
  const now = new Date();
  const updateFields = {
    status: nextStatus,
    updatedAt: now,
    updatedByTelegramId: telegramUserId,
    ...(nextStatus === 'cancelled' && reason ? { cancellationReason: reason } : {})
  };
  const updateDocument = nextStatus === 'cancelled' && reason
    ? { $set: updateFields }
    : { $set: updateFields, $unset: { cancellationReason: '' } };
  await orders.updateOne({ _id: order._id }, updateDocument);

  if (
    statusChanged
    && order.customerNotificationKey
    && ['confirmed', 'shipped', 'completed', 'cancelled'].includes(nextStatus)
  ) {
    await db.collection('customer_notifications').insertOne({
      customerNotificationKey: order.customerNotificationKey,
      orderId: order._id.toHexString(),
      orderNumber: order.orderNumber || order._id.toHexString(),
      status: nextStatus,
      statusLabel: ORDER_STATUS_LABELS[nextStatus],
      ...(nextStatus === 'cancelled' && reason ? { cancellationReason: reason } : {}),
      createdAt: now,
      readAt: null
    });
  }

  const reasonLine = nextStatus === 'cancelled' && reason ? '\nسبب الإلغاء: ' + reason : '';
  await sendTelegramMessage(
    chatId,
    '✅ تم تعديل حالة الطلب ' + (order.orderNumber || orderId) + '\nالحالة الجديدة: ' + ORDER_STATUS_LABELS[nextStatus] + reasonLine
  );
  await sendMainMenu(db, chatId);
}

async function showSliderMenu(chatId: number) {
  await sendTelegramMessage(chatId, 'إدارة سلايدر العروض\n\nاختر إضافة صورة جديدة أو حذف صورة موجودة:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ إضافة صورة', callback_data: 'slider-add' }],
        [{ text: '🗑 حذف صورة', callback_data: 'slider-delete' }],
        [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
      ]
    }
  });
}

async function showBannersForDelete(db: Db, chatId: number) {
  const banners = await db.collection<StoreBannerRecord>('store_banners').find({})
    .sort({ createdAt: 1, _id: 1 }).limit(12).toArray();

  if (!banners.length) {
    await sendTelegramMessage(chatId, 'لا توجد صور في السلايدر لحذفها.', {
      reply_markup: { inline_keyboard: [[{ text: '↩ رجوع إلى السلايدر', callback_data: 'slider-menu' }], [{ text: 'القائمة الرئيسية', callback_data: 'main-menu' }]] }
    });
    return;
  }

  await sendTelegramMessage(chatId, 'اضغط «حذف هذه الصورة» أسفل الصورة التي تريد إزالتها من واجهة المتجر. الحذف يتم مباشرة.');
  for (let index = 0; index < banners.length; index += 1) {
    const banner = banners[index];
    await telegramApi('sendPhoto', {
      chat_id: chatId,
      photo: banner.fileId || banner.imageUrl || '',
      caption: 'صورة السلايدر رقم ' + (index + 1),
      reply_markup: {
        inline_keyboard: [[{
          text: '🗑 حذف هذه الصورة',
          callback_data: 'delete-banner:' + banner._id.toHexString()
        }]]
      }
    });
  }
  await sendTelegramMessage(chatId, 'انتهت قائمة الصور.', {
    reply_markup: { inline_keyboard: [[{ text: '↩ رجوع إلى السلايدر', callback_data: 'slider-menu' }], [{ text: 'القائمة الرئيسية', callback_data: 'main-menu' }]] }
  });
}

async function showFooterPages(chatId: number, group: 'policies' | 'customer-service') {
  const pages = Object.entries(FOOTER_PAGE_DEFINITIONS).filter(([, page]) => page.group === group);
  const title = group === 'policies' ? 'السياسات' : 'خدمات العملاء';
  await sendTelegramMessage(chatId, 'اختر صفحة من «' + title + '» لتعديل النص الذي يظهر في نافذتها بالموقع:', {
    reply_markup: {
      inline_keyboard: [
        ...pages.map(([key, page]) => [{ text: page.title, callback_data: 'footer-page:' + key }]),
        [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
      ]
    }
  });
}



async function showReviewPage(db: Db, chatId: number, page = 0, notice = '') {
  const reviews = db.collection('customer_reviews');
  // Admin moderation intentionally includes demo/test reviews so the admin can remove them.
  const filter = {};
  const total = await reviews.countDocuments(filter);
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(0, Math.min(Number.isFinite(page) ? page : 0, pageCount - 1));

  if (!total) {
    const text = [
      notice,
      '⭐ تقييمات العملاء',
      'لا توجد تقييمات من العملاء حتى الآن.',
      'العدد الإجمالي: 0'
    ].filter(Boolean).join('\n\n');
    await sendTelegramMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '↩ رجوع إلى تعديلات أخرى', callback_data: 'footer-settings-menu' }],
          [{ text: 'القائمة الرئيسية', callback_data: 'main-menu' }]
        ]
      }
    });
    return;
  }

  const rows = await reviews.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(currentPage * pageSize)
    .limit(pageSize)
    .toArray();

  for (const review of rows) {
    const rating = Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5
      ? String(review.rating) + ' من 5 نجوم'
      : 'لم يحدد تقييمًا نجميًا';
    const createdAt = review.createdAt ? new Date(review.createdAt) : null;
    const date = createdAt && Number.isFinite(createdAt.getTime())
      ? createdAt.toLocaleDateString('ar-SA')
      : '—';
    const visibility = review.visible === false ? 'مخفي من الموقع' : 'ظاهر في الموقع';
    const message = [
      '⭐ تقييمات العملاء — إجمالي ' + total,
      'الاسم: ' + String(review.name || 'بدون اسم').slice(0, 80),
      'التعليق: ' + String(review.comment || '—').slice(0, 900),
      'التقييم: ' + rating,
      'الحالة: ' + visibility,
      'التاريخ: ' + date,
      'رقم الطلب: ' + String(review.orderNumber || '—').slice(0, 60)
    ].join('\n');
    await sendTelegramMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[{
          text: '🗑 حذف هذا التقييم',
          callback_data: 'review-delete:' + String(review._id) + ':' + currentPage
        }]]
      }
    });
  }

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  if (currentPage > 0) keyboard.push([{ text: '→ السابق', callback_data: 'review-page:' + (currentPage - 1) }]);
  if (currentPage < pageCount - 1) keyboard.push([{ text: 'التالي ←', callback_data: 'review-page:' + (currentPage + 1) }]);
  keyboard.push([{
    text: '📊 العدد: ' + total + ' | صفحة ' + (currentPage + 1) + '/' + pageCount,
    callback_data: 'review-page:' + currentPage
  }]);
  if (notice) keyboard.unshift([{ text: 'تمت العملية', callback_data: 'review-page:' + currentPage }]);
  keyboard.push([{ text: '↩ رجوع إلى تعديلات أخرى', callback_data: 'footer-settings-menu' }]);
  keyboard.push([{ text: 'القائمة الرئيسية', callback_data: 'main-menu' }]);

  await sendTelegramMessage(chatId,
    (notice ? notice + '\n\n' : '') + 'انتهت صفحة التقييمات ' + (currentPage + 1) + ' من ' + pageCount + '.',
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

async function showFooterSettings(db: Db, chatId: number) {
  const [settings, reviewCount] = await Promise.all([
    db.collection<{ _id: string; vatNumber?: string; vatNumberRemoved?: boolean; barcodeFileId?: string; barcodeRemoved?: boolean }>('store_settings')
      .findOne({ _id: 'footer' }),
    db.collection('customer_reviews').countDocuments({})
  ]);
  const vatNumber = settings?.vatNumberRemoved ? 'محذوف' : settings?.vatNumber || '4353454564';
  const barcodeStatus = settings?.barcodeFileId ? 'تمت إضافته' : settings?.barcodeRemoved ? 'محذوف' : 'باركود تصميمي مؤقت ظاهر في المتجر';
  await sendTelegramMessage(chatId,
    'تعديلات أخرى — بيانات الفوتر\n\nالرقم الضريبي: ' + vatNumber + '\nالباركود: ' + barcodeStatus + '\n\nاختر العنصر الذي تريد تعديله:',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'الرقم الضريبي', callback_data: 'footer-setting:vat' }, { text: 'الباركود', callback_data: 'footer-setting:barcode' }],
          [{ text: '🖼️ السلايدر', callback_data: 'footer-setting:slider' }],
          [{ text: 'السياسات', callback_data: 'footer-setting:policies' }, { text: 'خدمات العملاء', callback_data: 'footer-setting:customer-service' }],
          [{ text: '📞 الاتصال', callback_data: 'footer-setting:contact' }],
          [{ text: '⭐ تقييمات العملاء (' + reviewCount + ')', callback_data: 'footer-setting:reviews' }],
          [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
        ]
      }
    }
  );
}

async function showFooterBarcodeMenu(db: Db, chatId: number) {
  const settings = await db.collection<{ _id: string; barcodeFileId?: string }>('store_settings')
    .findOne({ _id: 'footer' });
  if (settings?.barcodeFileId) {
    await telegramApi('sendPhoto', {
      chat_id: chatId,
      photo: settings.barcodeFileId,
      caption: 'هذه صورة الباركود الحالية الظاهرة في فوتر المتجر.'
    });
  } else {
    await sendTelegramMessage(chatId, 'لم تتم إضافة صورة باركود للفوتر حتى الآن.');
  }
  await sendTelegramMessage(chatId, 'يمكنك استبدال الصورة بصورة جديدة أو حذفها من الفوتر:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📷 استبدال صورة الباركود', callback_data: 'footer-barcode-replace' }],
        [{ text: '🗑 حذف صورة الباركود', callback_data: 'footer-barcode-delete' }],
        [{ text: '↩ رجوع إلى تعديلات أخرى', callback_data: 'footer-settings-menu' }],
        [{ text: 'القائمة الرئيسية', callback_data: 'main-menu' }]
      ]
    }
  });
}

async function handleCallback(db: Db, callback: TelegramCallback) {
  await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
  const chat = callback.message?.chat;
  const chatId = chat?.id;
  if (!chatId || chat.type !== 'private' || chatId !== callback.from.id || !callback.data) return;
  const [action, id, field] = callback.data.split(':');

  if (action === 'product-color') {
    const session = await db.collection<AdminSession>('telegram_sessions').findOne({ telegramUserId: callback.from.id });
    if (!session || (session.step !== 'product_colors' && session.step !== 'edit_product_colors')) {
      await sendTelegramMessage(chatId, 'انتهت جلسة اختيار الألوان. افتح تعديل المنتج وادخل إلى الألوان مرة أخرى.');
      return;
    }
    const selectedColors = Array.isArray(session.data.colors) ? [...session.data.colors] : [];
    if (id === 'toggle' && field) {
      const option = PRODUCT_COLOR_OPTIONS.find((entry) => entry.key === field);
      if (!option) return void await sendTelegramMessage(chatId, 'اللون المحدد غير معروف.');
      session.data.colors = selectedColors.includes(option.name)
        ? selectedColors.filter((color) => color !== option.name)
        : [...selectedColors, option.name];
      await saveSession(db, session);
      await refreshProductColorMessage(chatId, callback.message?.message_id, session.data.colors);
      return;
    }
    if (id === 'clear') {
      session.data.colors = [];
      await saveSession(db, session);
      await refreshProductColorMessage(chatId, callback.message?.message_id, []);
      return;
    }
    if (id === 'done') {
      const savedColors = session.data.colors || [];
      try {
        if (callback.message?.message_id) {
          await telegramApi('editMessageText', {
            chat_id: chatId,
            message_id: callback.message.message_id,
            text: '✅ تم حفظ الألوان: ' + (savedColors.join('، ') || 'بدون ألوان.'),
            reply_markup: { inline_keyboard: [] }
          });
        }
      } catch (error) {
        console.error('Could not close product color picker:', error instanceof Error ? error.message : 'Unknown error');
      }
      if (session.workflow === 'add_product' && session.step === 'product_colors') {
        session.step = 'product_storage';
        await saveSession(db, session);
        await sendTelegramMessage(chatId, 'اكتب مساحات التخزين، مثال: 128GB، 256GB، 512GB. أو «تخطي».');
        return;
      }
      if (session.workflow === 'edit_product' && session.step === 'edit_product_colors' && session.data.productId && isObjectId(session.data.productId)) {
        const result = await db.collection<StoredProduct>('products').updateOne(
          { _id: new ObjectId(session.data.productId) },
          { $set: { colors: savedColors, updatedAt: new Date() } }
        );
        await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
        if (!result.matchedCount) {
          await sendMainMenu(db, chatId, 'لم يتم العثور على المنتج.');
          return;
        }
        await showProductEditMenu(db, chatId, session.data.productId);
        return;
      }
    }
    await sendTelegramMessage(chatId, 'تعذر حفظ اختيار الألوان. ارجع إلى القائمة الرئيسية ثم حاول مرة أخرى.');
    return;
  }

  if (action === 'slider-menu') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await showSliderMenu(chatId);
    return;
  }
  if (action === 'slider-add') {
    await startFlow(db, callback.from.id, chatId, 'slider', 'slider_image', {}, 'إضافة صورة للسلايدر\n\nأرسل صورة العرض أو الإعلان كصورة في تيليجرام. ستظهر بالموقع بعد حفظها. اكتب /cancel للإلغاء.');
    return;
  }
  if (action === 'slider-delete') {
    await showBannersForDelete(db, chatId);
    return;
  }
  if (action === 'delete-banner' && id && isObjectId(id)) {
    const result = await db.collection('store_banners').deleteOne({ _id: new ObjectId(id) });
    await sendTelegramMessage(chatId, result.deletedCount ? '✅ تم حذف الصورة من السلايدر في المتجر.' : 'الصورة غير موجودة أو سبق حذفها.');
    await showSliderMenu(chatId);
    return;
  }
  if (action === 'footer-settings-menu') {
    await showFooterSettings(db, chatId);
    return;
  }
  if (action === 'footer-setting' && id === 'vat') {
    const settings = await db.collection<{ _id: string; vatNumber?: string; vatNumberRemoved?: boolean }>('store_settings')
      .findOne({ _id: 'footer' });
    await startFlow(
      db,
      callback.from.id,
      chatId,
      'footer_settings',
      'footer_vat_number',
      { footerSettingKey: 'vat' },
      'تعديل الرقم الضريبي الظاهر أسفل اسم المتجر في الفوتر.\n\nالرقم الحالي: ' + (settings?.vatNumberRemoved ? 'محذوف' : settings?.vatNumber || '4353454564') + '\n\nأرسل الرقم الجديد بالأرقام فقط (من 5 إلى 30 رقمًا)، أو أرسل «مسح» لحذفه. اكتب /cancel للإلغاء.'
    );
    return;
  }
  if (action === 'footer-setting' && id === 'barcode') {
    await showFooterBarcodeMenu(db, chatId);
    return;
  }
  if (action === 'footer-setting' && id === 'reviews') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await showReviewPage(db, chatId, 0);
    return;
  }
  if (action === 'review-page') {
    await showReviewPage(db, chatId, Number(id || 0));
    return;
  }
  if (action === 'review-delete') {
    if (!isObjectId(id || '')) return void await sendTelegramMessage(chatId, 'معرّف التقييم غير صالح.');
    const page = Number(field || 0);
    const review = await db.collection('customer_reviews').findOne({
      _id: new ObjectId(id)
    });
    if (!review) {
      await showReviewPage(db, chatId, page, 'التقييم غير موجود أو سبق حذفه.');
      return;
    }
    await sendTelegramMessage(chatId,
      'تأكيد حذف تقييم العميل؟\n\nالاسم: ' + String(review.name || 'بدون اسم').slice(0, 80) +
      '\nالتعليق: ' + String(review.comment || '—').slice(0, 900) +
      '\n\nسيُحذف من قاعدة البيانات ولن يظهر في الموقع.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑 تأكيد الحذف', callback_data: 'review-confirm-delete:' + id + ':' + page }],
            [{ text: 'إلغاء والعودة للتقييمات', callback_data: 'review-page:' + page }],
            [{ text: '↩ رجوع إلى تعديلات أخرى', callback_data: 'footer-settings-menu' }]
          ]
        }
      }
    );
    return;
  }
  if (action === 'review-confirm-delete') {
    if (!isObjectId(id || '')) return void await sendTelegramMessage(chatId, 'معرّف التقييم غير صالح.');
    const page = Number(field || 0);
    const result = await db.collection('customer_reviews').deleteOne({
      _id: new ObjectId(id)
    });
    await showReviewPage(
      db,
      chatId,
      page,
      result.deletedCount ? '✅ تم حذف التقييم من قاعدة البيانات.' : 'التقييم غير موجود أو سبق حذفه.'
    );
    return;
  }
  if (action === 'footer-setting' && id === 'slider') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await showSliderMenu(chatId);
    return;
  }
  if (action === 'footer-setting' && id === 'policies') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await showFooterPages(chatId, 'policies');
    return;
  }
  if (action === 'footer-setting' && id === 'customer-service') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await showFooterPages(chatId, 'customer-service');
    return;
  }
  if (action === 'footer-setting' && id === 'contact') {
    await startFlow(
      db,
      callback.from.id,
      chatId,
      'contact',
      'contact_whatsapp',
      {},
      'الاتصال والدعم\n\nأرسل رقم واتساب مع مفتاح الدولة، مثال: 9665XXXXXXXX. يمكن تغييره لاحقًا من نفس الخيار.'
    );
    return;
  }
  if (action === 'footer-barcode-replace') {
    const settings = await db.collection<{ _id: string; barcodeFileId?: string }>('store_settings')
      .findOne({ _id: 'footer' });
    if (settings?.barcodeFileId) {
      await telegramApi('sendPhoto', {
        chat_id: chatId,
        photo: settings.barcodeFileId,
        caption: 'الباركود الحالي. أرسل صورة جديدة لاستبداله.'
      });
    }
    await startFlow(
      db,
      callback.from.id,
      chatId,
      'footer_settings',
      'footer_barcode_image',
      { footerSettingKey: 'barcode' },
      'أرسل صورة الباركود الجديدة كصورة في تيليجرام، وسيتم استبدال الصورة الحالية في الفوتر. اكتب /cancel للإلغاء.'
    );
    return;
  }
  if (action === 'footer-barcode-delete') {
    const result = await db.collection<{ _id: string; barcodeFileId?: string; updatedAt?: Date; updatedByTelegramId?: number }>('store_settings').updateOne(
      { _id: 'footer' },
      { $unset: { barcodeFileId: '' }, $set: { barcodeRemoved: true, updatedAt: new Date(), updatedByTelegramId: callback.from.id } }
    );
    await sendTelegramMessage(chatId,
      result.modifiedCount ? '✅ تم حذف الباركود من الفوتر.' : 'لا يوجد باركود محفوظ لحذفه.'
    );
    await showFooterSettings(db, chatId);
    return;
  }
  if (action === 'footer-page' && id && FOOTER_PAGE_DEFINITIONS[id]) {
    const definition = FOOTER_PAGE_DEFINITIONS[id];
    const saved = await db.collection<{ _id: string; content?: string; title?: string; group?: string; updatedAt?: Date; updatedByTelegramId?: number }>('store_pages').findOne({ _id: id });
    const current = typeof saved?.content === 'string' && saved.content.trim()
      ? saved.content
      : 'لم تتم إضافة نص لهذه الصفحة بعد.';
    const preview = current.length > 2000 ? current.slice(0, 2000) + '\n… (تم اختصار النص المعروض)' : current;
    await startFlow(
      db,
      callback.from.id,
      chatId,
      'footer_content',
      'footer_edit_text',
      { footerKey: id },
      'تعديل صفحة: ' + definition.title + '\n\nالمحتوى الحالي:\n' + preview + '\n\nأرسل النص الجديد بالكامل (حتى 3500 حرف). لن يتغير الموقع إلا بعد ضغط «حفظ النص».'
    );
    return;
  }
  if (action === 'main-menu') {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await sendMainMenu(db, chatId);
    return;
  }
  if (action === 'product-section') {
    if (!isObjectId(id || '')) return void await sendTelegramMessage(chatId, 'القسم المحدد غير صالح.');
    const section = await db.collection<StoreCategory>('categories').findOne({ _id: new ObjectId(id) });
    if (!section) return void await sendTelegramMessage(chatId, 'لم يتم العثور على القسم.');
    await startFlow(db, callback.from.id, chatId, 'add_product', 'product_name', {
      categoryId: section._id.toHexString(), categoryName: section.name, images: []
    }, 'القسم: ' + section.name + '\n\nاكتب اسم المنتج.');
    return;
  }
  if (action === 'rename-section') {
    if (!isObjectId(id || '')) return void await sendTelegramMessage(chatId, 'القسم المحدد غير صالح.');
    const section = await db.collection<StoreCategory>('categories').findOne({ _id: new ObjectId(id) });
    if (!section) return void await sendTelegramMessage(chatId, 'لم يتم العثور على القسم.');
    await startFlow(db, callback.from.id, chatId, 'rename_section', 'rename_section', {
      categoryId: section._id.toHexString(), categoryName: section.name
    }, 'القسم الحالي: ' + section.name + '\n\nاكتب الاسم الجديد فقط.');
    return;
  }
  if (action === 'edit-product') {
    await showProductEditMenu(db, chatId, id || '');
    return;
  }
  if (action === 'product-field') {
    if (!isObjectId(id || '')) return void await sendTelegramMessage(chatId, 'معرّف المنتج غير صالح.');
    const product = await db.collection<StoredProduct>('products').findOne({ _id: new ObjectId(id) });
    if (!product) return void await sendTelegramMessage(chatId, 'لم يتم العثور على المنتج.');
    const fieldToStep: Record<string, FlowStep> = {
      name: 'edit_product_name', colors: 'edit_product_colors', storage: 'edit_product_storage',
      price: 'edit_product_price', details: 'edit_product_details', images: 'edit_product_images'
    };
    if (field === 'category') {
      await ensureDefaultCategories(db);
      const sections = await db.collection<StoreCategory>('categories').find({}).sort({ name: 1 }).limit(80).toArray();
      await sendTelegramMessage(chatId, 'اختر القسم الجديد للمنتج:', {
        reply_markup: {
          inline_keyboard: [
            ...sections.map((section) => [{
              text: section.name.slice(0, 50),
              callback_data: 'move-product:' + id + ':' + section._id.toHexString()
            }]),
            [{ text: '↩ رجوع إلى المنتج', callback_data: 'edit-product:' + id }],
            [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
          ]
        }
      });
      return;
    }
    const step = fieldToStep[field || ''];
    if (!step) return void await sendTelegramMessage(chatId, 'الخانة غير معروفة.');
    if (step === 'edit_product_colors') {
      await startFlow(
        db, callback.from.id, chatId, 'edit_product', step,
        { productId: id, colors: product.colors || [] },
        productColorPrompt(product.colors || []),
        productColorKeyboard(product.colors || [])
      );
      return;
    }
    if (step === 'edit_product_images') {
      await startFlow(db, callback.from.id, chatId, 'edit_product', step, { productId: id, images: [] },
        'أرسل الصور الجديدة للمنتج. سيؤدي الحفظ إلى استبدال الصور القديمة. أرسل صورة أو أكثر ثم اضغط «حفظ المنتج».',
        { keyboard: [[{ text: SAVE_PRODUCT_TEXT }], [{ text: MAIN_MENU_TEXT }]], resize_keyboard: true, one_time_keyboard: false });
      return;
    }
    const prompts: Record<string, string> = {
      name: 'الاسم الحالي: ' + product.name + '\n\nأرسل الاسم الجديد.',
      colors: 'الألوان الحالية: ' + (product.colors || []).join('، ') + '\n\nأرسل الألوان الجديدة مفصولة بفاصلة، أو «تخطي» لمسحها.',
      storage: 'مساحات التخزين الحالية: ' + (product.storageOptions || []).join('، ') + '\n\nأرسل المساحات الجديدة مفصولة بفاصلة، أو «تخطي» لمسحها.',
      price: 'السعر الحالي: ' + product.price + ' ر.س\n\nأرسل السعر الجديد بالريال.',
      details: 'التفاصيل الحالية:\n' + product.details + '\n\nأرسل التفاصيل الجديدة.'
    };
    await startFlow(db, callback.from.id, chatId, 'edit_product', step, { productId: id }, prompts[field || 'name'] || 'أرسل القيمة الجديدة.');
    return;
  }
  if (action === 'move-product') {
    if (!isObjectId(id || '') || !isObjectId(field || '')) {
      await sendTelegramMessage(chatId, 'معرّف المنتج أو القسم غير صالح.');
      return;
    }
    const [product, section] = await Promise.all([
      db.collection<StoredProduct>('products').findOne({ _id: new ObjectId(id) }),
      db.collection<StoreCategory>('categories').findOne({ _id: new ObjectId(field) })
    ]);
    if (!product || !section) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على المنتج أو القسم.');
      return;
    }
    await db.collection<StoredProduct>('products').updateOne(
      { _id: product._id },
      { $set: { categoryId: section._id.toHexString(), category: section.name, updatedAt: new Date() } }
    );
    await showProductEditMenu(db, chatId, id);
    return;
  }
  if (action === 'delete-product') {
    if (!isObjectId(id || '')) return void await sendTelegramMessage(chatId, 'معرّف المنتج غير صالح.');
    const product = await db.collection<StoredProduct>('products').findOne({ _id: new ObjectId(id) });
    if (!product) return void await sendTelegramMessage(chatId, 'لم يتم العثور على المنتج.');
    await sendTelegramMessage(chatId, 'هل تؤكد حذف المنتج «' + product.name + '»؟ لا يمكن التراجع عن الحذف.', {
      reply_markup: { inline_keyboard: [
        [{ text: 'تأكيد حذف المنتج', callback_data: 'confirm-delete-product:' + id }],
        [{ text: 'إلغاء والعودة للمنتج', callback_data: 'edit-product:' + id }],
        [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
      ] }
    });
    return;
  }
  if (action === 'confirm-delete-product') {
    if (!isObjectId(id || '')) return void await sendTelegramMessage(chatId, 'معرّف المنتج غير صالح.');
    const result = await db.collection('products').deleteOne({ _id: new ObjectId(id) });
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await sendMainMenu(db, chatId, result.deletedCount ? '🗑 تم حذف المنتج من المتجر.' : 'المنتج غير موجود أو سبق حذفه.');
    return;
  }
  if (action === 'edit-order') {
    await listOrderDetails(db, chatId, id || '');
    return;
  }
  if (action === 'skip-cancel-reason' && id && isObjectId(id)) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: callback.from.id });
    await updateOrderStatus(db, chatId, callback.from.id, id, 'cancelled', '');
    return;
  }
  if (action === 'status' && field === 'preparing') {
    await sendTelegramMessage(chatId, 'حالة «قيد التجهيز» لم تعد متاحة. اختر حالة أخرى من تفاصيل الطلب.');
    return;
  }
  if (action === 'status' && id && field === 'cancelled' && isObjectId(id)) {
    const order = await db.collection<StoreOrder>('orders').findOne({ _id: new ObjectId(id) });
    if (!order) return void await sendTelegramMessage(chatId, 'لم يتم العثور على الطلب.');
    await startFlow(
      db,
      callback.from.id,
      chatId,
      'cancel_order',
      'cancel_reason',
      { orderId: id },
      'إلغاء الطلب ' + (order.orderNumber || id) + '\n\nاكتب سبب الإلغاء (اختياري)، وسيظهر للعميل في إشعار المتصفح. أو اضغط «إلغاء بدون تعليق».',
      {
        inline_keyboard: [
          [{ text: 'إلغاء بدون تعليق', callback_data: 'skip-cancel-reason:' + id }],
          [{ text: '↩ رجوع إلى القائمة الرئيسية', callback_data: 'main-menu' }]
        ]
      }
    );
    return;
  }
  if (action === 'status' && id && field && field in ORDER_STATUS_LABELS && field !== 'preparing' && isObjectId(id)) {
    await updateOrderStatus(db, chatId, callback.from.id, id, field as OrderStatus);
    return;
  }
  await sendTelegramMessage(chatId, 'الأمر غير معروف. ارجع إلى القائمة الرئيسية.');
}

async function handleFlowMessage(db: Db, session: AdminSession, message: TelegramMessage) {
  const chatId = message.chat.id;
  const value = message.text?.trim() || '';

  if (session.workflow === 'slider' && session.step === 'slider_image') {
    if (!message.photo?.length) {
      await sendTelegramMessage(chatId, 'أرسل الصورة كصورة في تيليجرام، وليس كرابط نصي. اكتب /cancel للإلغاء.');
      return;
    }
    const bannerCount = await db.collection<StoreBannerRecord>('store_banners').countDocuments({});
    if (bannerCount >= 12) {
      await sendTelegramMessage(chatId, 'السلايدر ممتلئ بـ12 صورة. احذف صورة قديمة من «السلايدر ← حذف صورة» ثم أضف صورة جديدة.');
      return;
    }
    const photo = message.photo[message.photo.length - 1];
    await db.collection<StoreBannerRecord>('store_banners').insertOne({
      _id: new ObjectId(),
      fileId: photo.file_id,
      createdAt: new Date(),
      createdByTelegramId: session.telegramUserId
    });
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendMainMenu(db, chatId, '✅ تمت إضافة صورة للسلايدر. ستظهر في واجهة المتجر عند تحديث الصور.');
    return;
  }

  if (session.workflow === 'footer_settings' && session.step === 'footer_vat_number') {
    if (value === 'مسح' || value === 'حذف') {
      const result = await db.collection<{ _id: string; vatNumber?: string; updatedAt?: Date; updatedByTelegramId?: number }>('store_settings').updateOne(
        { _id: 'footer' },
        { $set: { vatNumber: '', vatNumberRemoved: true, updatedAt: new Date(), updatedByTelegramId: session.telegramUserId } }
      );
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
      await sendMainMenu(db, chatId, result.modifiedCount ? '✅ تم حذف الرقم الضريبي من الفوتر.' : 'لا يوجد رقم ضريبي محفوظ لحذفه.');
      return;
    }
    const vatNumber = value
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[\s-]/g, '');
    if (!/^\d{5,30}$/.test(vatNumber)) {
      await sendTelegramMessage(chatId, 'الرقم غير صالح. أرسل من 5 إلى 30 رقمًا فقط، ويمكن فصل الأرقام بمسافات أو شرطات.');
      return;
    }
    await db.collection<{ _id: string; vatNumber?: string; updatedAt?: Date; updatedByTelegramId?: number }>('store_settings').updateOne(
      { _id: 'footer' },
      { $set: { vatNumber, vatNumberRemoved: false, updatedAt: new Date(), updatedByTelegramId: session.telegramUserId } },
      { upsert: true }
    );
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendMainMenu(db, chatId, '✅ تم حفظ الرقم الضريبي وسيظهر أسفل اسم المتجر في الفوتر.');
    return;
  }

  if (session.workflow === 'footer_settings' && session.step === 'footer_barcode_image') {
    if (!message.photo?.length) {
      await sendTelegramMessage(chatId, 'أرسل صورة الباركود كصورة في تيليجرام، وليس كرابط نصي. اكتب /cancel للإلغاء.');
      return;
    }
    const photo = message.photo[message.photo.length - 1];
    await db.collection<{ _id: string; barcodeFileId?: string; updatedAt?: Date; updatedByTelegramId?: number }>('store_settings').updateOne(
      { _id: 'footer' },
      { $set: { barcodeFileId: photo.file_id, updatedAt: new Date(), updatedByTelegramId: session.telegramUserId }, $unset: { barcodeRemoved: '' } },
      { upsert: true }
    );
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendMainMenu(db, chatId, '✅ تم حفظ صورة الباركود وتحديثها في الفوتر.');
    return;
  }

  if (session.workflow === 'footer_content' && session.step === 'footer_edit_text') {
    const footerKey = session.data.footerKey || '';
    if (!FOOTER_PAGE_DEFINITIONS[footerKey]) {
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
      await sendMainMenu(db, chatId, 'تعذر تحديد صفحة الفوتر.');
      return;
    }
    if (!value) {
      await sendTelegramMessage(chatId, 'أرسل نص الصفحة، أو اكتب /cancel للإلغاء.');
      return;
    }
    if (value.length > 3500) {
      await sendTelegramMessage(chatId, 'النص طويل جدًا. الحد الأقصى 3500 حرف حتى يظهر بشكل صحيح. اختصر النص وأرسله مرة أخرى.');
      return;
    }
    session.data.content = value;
    session.step = 'footer_confirm_save';
    await saveSession(db, session);
    const preview = value.length > 2200 ? value.slice(0, 2200) + '\n… (معاينة مختصرة للنص)' : value;
    await sendTelegramMessage(chatId, 'معاينة صفحة «' + FOOTER_PAGE_DEFINITIONS[footerKey].title + '» قبل الحفظ:\n\n' + preview + '\n\nاضغط «حفظ النص» لنشره في نافذة الصفحة بالفوتر.', {
      reply_markup: {
        keyboard: [[{ text: SAVE_FOOTER_TEXT }], [{ text: REWRITE_FOOTER_TEXT }], [{ text: MAIN_MENU_TEXT }]],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });
    return;
  }

  if (session.workflow === 'footer_content' && session.step === 'footer_confirm_save') {
    if (value === REWRITE_FOOTER_TEXT) {
      session.step = 'footer_edit_text';
      delete session.data.content;
      await saveSession(db, session);
      await sendTelegramMessage(chatId, 'أرسل النص الجديد بالكامل لصفحة «' + (FOOTER_PAGE_DEFINITIONS[session.data.footerKey || '']?.title || '') + '».');
      return;
    }
    if (value !== SAVE_FOOTER_TEXT) {
      await sendTelegramMessage(chatId, 'اضغط «حفظ النص» لنشر المحتوى، أو «إعادة الكتابة» لتعديله.');
      return;
    }
    const footerKey = session.data.footerKey || '';
    const definition = FOOTER_PAGE_DEFINITIONS[footerKey];
    const content = session.data.content || '';
    if (!definition || !content.trim()) {
      await sendTelegramMessage(chatId, 'النص أو الصفحة غير صالح. اختر الصفحة من جديد.');
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
      await sendMainMenu(db, chatId);
      return;
    }
    await db.collection<{ _id: string; title?: string; group?: string; content?: string; updatedAt?: Date; updatedByTelegramId?: number }>('store_pages').updateOne(
      { _id: footerKey },
      { $set: { title: definition.title, group: definition.group, content, updatedAt: new Date(), updatedByTelegramId: session.telegramUserId } },
      { upsert: true }
    );
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendMainMenu(db, chatId, '✅ تم حفظ صفحة «' + definition.title + '» وتحديث محتواها في فوتر المتجر.');
    return;
  }

  if (session.step === 'product_images' || session.step === 'edit_product_images') {
    await handleImageStep(db, session, message);
    return;
  }
  if (session.workflow === 'edit_product') {
    if (!value) return void await sendTelegramMessage(chatId, 'أرسل القيمة المطلوبة نصًا.');
    await saveEditedField(db, session, value, chatId);
    return;
  }
  if (session.workflow === 'contact' && session.step === 'contact_whatsapp') {
    const phone = normalizeWhatsAppNumber(value);
    if (!phone) return void await sendTelegramMessage(chatId, 'رقم واتساب غير صالح. أرسله مع مفتاح الدولة، أو اكتب رقمًا سعوديًا مثل 05XXXXXXXX.');
    await db.collection<{ _id: string; whatsappNumber?: string; updatedAt?: Date; updatedByTelegramId?: number }>('store_settings').updateOne(
      { _id: 'contact' },
      { $set: { whatsappNumber: phone, whatsappNumberRemoved: false, updatedAt: new Date(), updatedByTelegramId: session.telegramUserId } },
      { upsert: true }
    );
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendMainMenu(db, chatId, '✅ تم حفظ رقم واتساب الدعم. رابط التواصل: https://wa.me/' + phone);
    return;
  }
  if (session.workflow === 'cancel_order' && session.step === 'cancel_reason') {
    const orderId = session.data.orderId || '';
    if (!isObjectId(orderId)) {
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
      await sendMainMenu(db, chatId, 'تعذر تحديد الطلب المراد إلغاؤه.');
      return;
    }
    if (value.length > 500) {
      await sendTelegramMessage(chatId, 'سبب الإلغاء طويل جدًا. اكتب تعليقًا لا يتجاوز 500 حرف، أو اضغط «إلغاء بدون تعليق».');
      return;
    }
    const reason = value === 'بدون تعليق' ? '' : value;
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await updateOrderStatus(db, chatId, session.telegramUserId, orderId, 'cancelled', reason);
    return;
  }

  if (!value) return void await sendTelegramMessage(chatId, 'أرسل النص المطلوب أو /cancel للإلغاء.');

  if (session.workflow === 'add_section' && session.step === 'section_name') {
    try {
      await saveCategory(db, value);
      await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
      await sendMainMenu(db, chatId, '✅ تم حفظ القسم «' + value + '» بالاسم فقط. سيظهر ضمن أقسام المنتجات.');
    } catch (error) {
      await sendTelegramMessage(chatId, error instanceof Error ? error.message : 'تعذر حفظ القسم.');
    }
    return;
  }
  if (session.workflow === 'rename_section' && session.step === 'rename_section') {
    const categoryId = session.data.categoryId || '';
    if (!isObjectId(categoryId)) return void await sendTelegramMessage(chatId, 'تعذر تحديد القسم. ارجع إلى القائمة وحاول مجددًا.');
    const normalized = value.replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > 80) return void await sendTelegramMessage(chatId, 'الاسم يجب أن يكون من حرفين إلى 80 حرفًا.');
    const otherSections = await db.collection<StoreCategory>('categories').find({ _id: { $ne: new ObjectId(categoryId) } }).toArray();
    if (otherSections.some((section) => section.name.trim().toLocaleLowerCase('ar') === normalized.toLocaleLowerCase('ar'))) {
      return void await sendTelegramMessage(chatId, 'يوجد قسم آخر بهذا الاسم. اكتب اسمًا مختلفًا.');
    }
    const result = await db.collection<StoreCategory>('categories').findOneAndUpdate(
      { _id: new ObjectId(categoryId) }, { $set: { name: normalized, updatedAt: new Date() } }, { returnDocument: 'after' }
    );
    if (!result) return void await sendTelegramMessage(chatId, 'لم يتم العثور على القسم.');
    await db.collection('products').updateMany({ categoryId }, { $set: { category: normalized, updatedAt: new Date() } });
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: session.telegramUserId });
    await sendMainMenu(db, chatId, '✅ تم تعديل اسم القسم إلى «' + normalized + '».');
    return;
  }

  if (session.workflow === 'add_product') {
    if (session.step === 'product_name') {
      if (value.length < 2 || value.length > 120) return void await sendTelegramMessage(chatId, 'اسم المنتج يجب أن يكون من حرفين إلى 120 حرفًا.');
      session.data.name = value; session.data.colors = []; session.step = 'product_colors'; await saveSession(db, session);
      await sendTelegramMessage(chatId, productColorPrompt([]), { reply_markup: productColorKeyboard([]) });
      return;
    }
    if (session.step === 'product_colors') {
      session.data.colors = value === 'تخطي' ? [] : parseList(value); session.step = 'product_storage'; await saveSession(db, session);
      await sendTelegramMessage(chatId, 'اكتب مساحات التخزين، مثال: 128GB، 256GB، 512GB. أو «تخطي».');
      return;
    }
    if (session.step === 'product_storage') {
      session.data.storageOptions = value === 'تخطي' ? [] : parseList(value); session.step = 'product_price'; await saveSession(db, session);
      await sendTelegramMessage(chatId, 'اكتب سعر المنتج بالريال السعودي، مثال: 6099.');
      return;
    }
    if (session.step === 'product_price') {
      const price = normalizeAmount(value);
      if (!Number.isFinite(price) || price <= 0 || price > 100000000) return void await sendTelegramMessage(chatId, 'السعر غير صحيح. اكتب مبلغًا أكبر من صفر.');
      session.data.price = price; session.step = 'product_details'; await saveSession(db, session);
      await sendTelegramMessage(chatId, 'اكتب تفاصيل المنتج ومواصفاته.');
      return;
    }
    if (session.step === 'product_details') {
      if (value.length < 2 || value.length > 3000) return void await sendTelegramMessage(chatId, 'التفاصيل يجب أن تكون من حرفين إلى 3000 حرف.');
      session.data.details = value; session.step = 'product_images'; session.data.images = []; await saveSession(db, session);
      await sendTelegramMessage(chatId, 'أرسل صورة المنتج. يمكنك إرسال حتى 10 صور، ثم اضغط «حفظ المنتج».', {
        reply_markup: { keyboard: [[{ text: SAVE_PRODUCT_TEXT }], [{ text: MAIN_MENU_TEXT }]], resize_keyboard: true, one_time_keyboard: false }
      });
    }
  }
}

async function handleUpdate(db: Db, update: TelegramUpdate) {
  if (update.callback_query) {
    if (!isAuthorized(update.callback_query.from.id)) {
      await telegramApi('answerCallbackQuery', { callback_query_id: update.callback_query.id, text: 'غير مصرح لك بالإدارة.', show_alert: true });
      return;
    }
    await handleCallback(db, update.callback_query);
    return;
  }

  const message = update.message;
  const from = message?.from;
  const chatId = message?.chat.id;
  const value = message?.text?.trim() || '';
  if (!message || !from || !chatId || message.chat.type !== 'private' || chatId !== from.id || !isAuthorized(from.id)) return;

  if (value === '/start' || value === '/menu' || value === MAIN_MENU_TEXT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await sendMainMenu(db, chatId);
    return;
  }
  if (value === CANCEL_TEXT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await sendMainMenu(db, chatId, 'تم إلغاء العملية الحالية.');
    return;
  }
  const normalizedText = value.replace(/^🔔\s*/, '').replace(/\s*\(\d+\+?\)$/, '');
  if (normalizedText === MENU_ORDERS) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await showCustomerOrders(db, chatId);
    return;
  }
  if (value === MENU_ADD_SECTION) {
    await startFlow(db, from.id, chatId, 'add_section', 'section_name', {}, 'إضافة قسم جديد\n\nأرسل الاسم فقط. اكتب /cancel للإلغاء.');
    return;
  }
  if (value === MENU_EDIT_SECTION) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await listSectionsForEdit(db, chatId);
    return;
  }
  if (value === MENU_ADD_PRODUCT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await listSectionsForProduct(db, chatId);
    return;
  }
  if (value === MENU_EDIT_PRODUCT) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await listProductsForEdit(db, chatId);
    return;
  }
  if (value === MENU_SLIDER) {
    await showSliderMenu(chatId);
    return;
  }
  if (value === MENU_POLICIES) {
    await showFooterPages(chatId, 'policies');
    return;
  }
  if (value === MENU_CUSTOMER_SERVICE) {
    await showFooterPages(chatId, 'customer-service');
    return;
  }
  if (value === MENU_FOOTER_SETTINGS) {
    await db.collection('telegram_sessions').deleteOne({ telegramUserId: from.id });
    await showFooterSettings(db, chatId);
    return;
  }
  if (value === MENU_CONTACT) {
    await startFlow(db, from.id, chatId, 'contact', 'contact_whatsapp', {}, 'الاتصال والدعم\n\nأرسل رقم واتساب مع مفتاح الدولة، مثال: 9665XXXXXXXX. يمكن تغييره لاحقًا من نفس الزر.');
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
    if (!Number.isSafeInteger(update.update_id)) return NextResponse.json({ ok: false, error: 'Invalid Telegram update' }, { status: 400 });
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
