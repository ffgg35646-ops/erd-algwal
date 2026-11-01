import { randomInt } from 'node:crypto';
import { ObjectId, type Db, type Document } from 'mongodb';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/telegram';

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
  cardLast4?: string;
  expiryMonth?: string;
  expiryYear?: string;
  paymentMethodSelectedAt?: Date;
  adminNotificationSentAt?: Date;
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

export function makeOrderNumber() {
  return `#${randomInt(10, 1000)}`;
}

export function formatOrderForAdmin(order: Record<string, unknown>) {
  const customer = (order.customer && typeof order.customer === 'object')
    ? order.customer as Record<string, unknown>
    : {};
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  const status = typeof order.status === 'string' && order.status in ORDER_STATUS_LABELS
    ? ORDER_STATUS_LABELS[order.status as OrderStatus]
    : 'غير محدد';
  const itemText = items.slice(0, 12).map((item, index) => {
    const name = String(item.name || 'منتج');
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(item.unitPrice);
    const lineTotal = Number.isFinite(unitPrice)
      ? (unitPrice * quantity).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س'
      : '';
    return [
      `${index + 1}) ${name}`,
      `   العدد: ${quantity}${item.color ? ' | اللون: ' + String(item.color) : ''}${lineTotal ? ' | الإجمالي: ' + lineTotal : ''}`
    ].join('\\n');
  }).join('\\n') || 'لا توجد منتجات مسجلة';
  const total = Number(order.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const paymentMethod = order.paymentMethod === 'mada' ? 'مدى' : order.paymentMethod === 'visa' ? 'Visa' : 'لم يتم الاختيار';
  const paymentStatus = order.paymentStatus === 'paid'
    ? 'مدفوع'
    : order.paymentStatus === 'failed'
      ? 'فشل الدفع'
      : 'بانتظار تأكيد الدفع';
  const installmentText = order.installment === true
    ? `نعم — دفعة مقدمة ${Number(order.installmentDownPayment || 0).toLocaleString('en-US')} ر.س — ${Number(order.installmentMonths || 0)} شهر`
    : 'لا';
  const visaDetails = order.paymentMethod === 'visa'
    ? [
        ...(typeof order.cardholderName === 'string' && order.cardholderName.trim()
          ? [`اسم حامل البطاقة: ${order.cardholderName.trim()}`]
          : []),
        ...(typeof order.cardLast4 === 'string' && /^[0-9]{4}$/.test(order.cardLast4)
          ? [`آخر 4 أرقام: •••• ${order.cardLast4}`]
          : []),
        ...(typeof order.expiryMonth === 'string' && typeof order.expiryYear === 'string'
          ? [`تاريخ الانتهاء: ${order.expiryMonth}/${order.expiryYear.slice(-2)}`]
          : [])
      ]
    : [];

  return [
    '🧾 تفاصيل الطلب',
    `🔢 رقم الطلب: ${String(order.orderNumber || order._id || '—')}`,
    '━━━━━━━━━━━━━━━━',
    '👤 بيانات العميل',
    `الاسم: ${String(customer.name || '—')}`,
    `📞 الجوال: ${String(customer.phone || '—')}`,
    ...(typeof customer.email === 'string' && customer.email.trim() ? [`✉️ البريد: ${customer.email.trim()}`] : []),
    ...(typeof customer.idNumber === 'string' && customer.idNumber.trim() ? [`🪪 الهوية: ${customer.idNumber.trim()}`] : []),
    '━━━━━━━━━━━━━━━━',
    '📍 عنوان التوصيل',
    String(customer.address || '—'),
    '━━━━━━━━━━━━━━━━',
    `🛒 المنتجات (${items.length})`,
    itemText,
    '━━━━━━━━━━━━━━━━',
    '💰 ملخص الحساب',
    `الإجمالي: ${total} ر.س`,
    `التقسيط: ${installmentText}`,
    '━━━━━━━━━━━━━━━━',
    '💳 بيانات الدفع',
    `طريقة الدفع: ${paymentMethod}`,
    ...visaDetails,
    `حالة الدفع: ${paymentStatus}`,
    '━━━━━━━━━━━━━━━━',
    `📦 حالة الطلب: ${status}`,
    ...(typeof order.notes === 'string' && order.notes.trim() ? [`📝 ملاحظات: ${order.notes.trim()}`] : []),
    ...(typeof order.cancellationReason === 'string' && order.cancellationReason.trim()
      ? [`سبب الإلغاء: ${order.cancellationReason.trim()}`]
      : [])
  ].join('\\n');
}

export async function getRecentOrders(db: Db, limit = 10) {
  return db.collection<StoreOrder>('orders')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
