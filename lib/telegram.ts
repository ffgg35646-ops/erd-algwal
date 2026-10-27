import type { Db } from 'mongodb';

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'shipped' | 'completed' | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'تم التأكيد',
  preparing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  completed: 'مكتمل',
  cancelled: 'ملغي'
};

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export type TelegramButton = {
  text: string;
  callback_data: string;
};

export async function telegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  const data = await response.json() as TelegramResponse<T>;
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API request failed: ${method}`);
  }
  return data.result as T;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {}
) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra
  });
}

export function adminReplyKeyboard(unreadCount = 0) {
  const ordersLabel = unreadCount > 0
    ? `🔔 طلبات العملاء (${Math.min(unreadCount, 99)}${unreadCount > 99 ? '+' : ''})`
    : 'طلبات العملاء';
  return {
    keyboard: [
      [{ text: ordersLabel }],
      [{ text: 'إضافة قسم' }, { text: 'تعديل قسم' }],
      [{ text: 'إضافة منتج' }, { text: 'تعديل المنتج' }],
      [{ text: 'السلايدر' }],
      [{ text: 'السياسات' }, { text: 'خدمات العملاء' }],
      [{ text: 'الاتصال' }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    one_time_keyboard: false
  };
}

export function statusInlineKeyboard(orderId: string) {
  const statuses: OrderStatus[] = ['confirmed', 'shipped', 'completed', 'cancelled'];
  return {
    inline_keyboard: statuses.map((status) => [{
      text: ORDER_STATUS_LABELS[status],
      callback_data: `status:${orderId}:${status}`
    }])
  };
}

export async function ensureTelegramIndexes(db: Db) {
  await db.collection('telegram_updates').createIndex({ updateId: 1 }, { unique: true });
  await db.collection('telegram_sessions').createIndex({ telegramUserId: 1 }, { unique: true });
  await db.collection('orders').createIndex({ createdAt: -1 });
  await db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true, sparse: true });
  await db.collection('orders').createIndex({ checkoutRequestId: 1 }, { unique: true, sparse: true });
  await db.collection('orders').createIndex({ customerNotificationKey: 1 });
  await db.collection('customer_notifications').createIndex({ customerNotificationKey: 1, createdAt: -1 });
  await db.collection('customer_notifications').createIndex({ customerNotificationKey: 1, readAt: 1, createdAt: -1 });
}
