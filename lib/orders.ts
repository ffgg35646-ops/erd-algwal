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
      `${index + 1}. ${name}`,
      `   الكمية: ${quantity}${item.color ? ' | اللون: ' + String(item.color) : ''}${lineTotal ? ' | الإجمالي: ' + lineTotal : ''}`
    ].join('\n');
  }).join('\n') || 'لا توجد تفاصيل منتجات متاحة';
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

  return [
    '🛍️ طلب جديد من المتجر',
    `🧾 رقم الطلب: ${String(order.orderNumber || order._id || '—')}`,
    '━━━━━━━━━━━━━━',
    '👤 بيانات العميل',
    `الاسم: ${String(customer.name || '—')}`,
    `الجوال: ${String(customer.phone || '—')}`,
    ...(typeof customer.email === 'string' && customer.email.trim() ? [`البريد: ${customer.email.trim()}`] : []),
    ...(typeof customer.idNumber === 'string' && customer.idNumber.trim() ? [`رقم الهوية: ${customer.idNumber.trim()}`] : []),
    '━━━━━━━━━━━━━━',
    '📍 عنوان التوصيل',
    String(customer.address || '—'),
    '━━━━━━━━━━━━━━',
    `🛒 المنتجات (${items.length})`,
    itemText,
    '━━━━━━━━━━━━━━',
    '💰 ملخص الطلب',
    `الإجمالي: ${total} ر.س`,
    `التقسيط: ${installmentText}`,
    '━━━━━━━━━━━━━━',
    '💳 الدفع',
    `طريقة الدفع المختارة: ${paymentMethod}`,
    `حالة الدفع: ${paymentStatus}`,
    '━━━━━━━━━━━━━━',
    '📦 متابعة الطلب',
    `حالة الطلب: ${status}`,
    ...(typeof order.notes === 'string' && order.notes.trim() ? [`ملاحظات العميل: ${order.notes.trim()}`] : []),
    `المصدر: ${order.source === 'telegram_manual' ? 'أضيف من البوت' : 'المتجر الإلكتروني'}`
  ].join('\n');
}

export async function getRecentOrders(db: Db, limit = 10) {
  return db.collection<StoreOrder>('orders')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
