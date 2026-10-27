import { ObjectId, type Document } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CustomerNotification = Document & {
  _id: ObjectId;
  customerNotificationKey: string;
  orderId: string;
  orderNumber: string;
  status: 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  statusLabel: string;
  cancellationReason?: string;
  createdAt: Date;
  readAt?: Date | null;
};

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { 'cache-control': 'no-store, max-age=0' };

function validKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validKey(key)) {
    return NextResponse.json({ ok: false, error: 'مفتاح إشعارات غير صالح.' }, { status: 400, headers: noStore });
  }

  try {
    const db = await getDb();
    const collection = db.collection<CustomerNotification>('customer_notifications');
    const [items, unreadCount] = await Promise.all([
      collection.find({ customerNotificationKey: key })
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray(),
      collection.countDocuments({ customerNotificationKey: key, readAt: null })
    ]);

    return NextResponse.json({
      ok: true,
      unreadCount,
      notifications: items.map((item) => ({
        id: item._id.toHexString(),
        orderNumber: item.orderNumber,
        status: item.status,
        statusLabel: item.statusLabel,
        cancellationReason: item.cancellationReason || '',
        createdAt: new Date(item.createdAt).toISOString(),
        read: Boolean(item.readAt)
      }))
    }, { headers: noStore });
  } catch (error) {
    console.error('Customer notifications read failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر تحميل الإشعارات حاليًا.' }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  let body: { key?: unknown; action?: unknown };
  try {
    body = await request.json() as { key?: unknown; action?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'الطلب غير صالح.' }, { status: 400, headers: noStore });
  }

  if (!validKey(body.key) || body.action !== 'mark-read') {
    return NextResponse.json({ ok: false, error: 'تعذر تحديث الإشعارات.' }, { status: 400, headers: noStore });
  }

  try {
    const db = await getDb();
    await db.collection<CustomerNotification>('customer_notifications').updateMany(
      { customerNotificationKey: body.key, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error('Customer notifications update failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ ok: false, error: 'تعذر تحديث الإشعارات.' }, { status: 500, headers: noStore });
  }
}
