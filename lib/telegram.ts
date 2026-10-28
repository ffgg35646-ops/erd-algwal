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
  const suppliedMarkup = extra.reply_markup as {
    keyboard?: Array<Array<{ text: string; [key: string]: unknown }>>;
    inline_keyboard?: Array<Array<{ text: string; callback_data?: string; [key: string]: unknown }>>;
    [key: string]: unknown;
  } | undefined;

  let replyMarkup = suppliedMarkup;
  if (!suppliedMarkup) {
    // Keep a menu shortcut available while the admin moves through a workflow.
    replyMarkup = {
      keyboard: [[{ text: 'رجوع إلى القائمة الرئيسية' }]],
      resize_keyboard: true,
      is_persistent: true,
      one_time_keyboard: false
    };
  } else if (Array.isArray(suppliedMarkup.inline_keyboard)) {
    const rows = suppliedMarkup.inline_keyboard;
    const hasMainMenu = rows.some((row) => row.some((button) => button.callback_data === 'main-menu'));
    if (!hasMainMenu) {
      replyMarkup = {
        ...suppliedMarkup,
        inline_keyboard: [...rows, [{ text: '↩ القائمة الرئيسية', callback_data: 'main-menu' }]]
      };
    }
  } else if (Array.isArray(suppliedMarkup.keyboard)) {
    const rows = suppliedMarkup.keyboard;
    const hasMenuShortcut = rows.some((row) => row.some((button) => button.text === 'رجوع إلى القائمة الرئيسية'));
    const hasMainMenuItems = rows.some((row) => row.some((button) => ['طلبات العملاء', 'إضافة طلب', 'تعديل الطلب', 'إضافة قسم', 'تعديل قسم', 'إضافة منتج', 'تعديل المنتج', 'تعديلات أخرى'].includes(button.text.replace(/^🔔\\s*/, '').replace(/\\s*\\(\\d+\\+?\\)$/, ''))));
    if (!hasMenuShortcut && !hasMainMenuItems) {
      replyMarkup = {
        ...suppliedMarkup,
        keyboard: [...rows, [{ text: 'رجوع إلى القائمة الرئيسية' }]],
        resize_keyboard: true,
        is_persistent: true,
        one_time_keyboard: false
      };
    }
  }

  return telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
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
      [{ text: 'تعديلات أخرى' }]
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
