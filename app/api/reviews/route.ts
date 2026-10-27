import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const reviews = await db.collection('customer_reviews')
      .find({ visible: { $ne: false }, isDemo: { $ne: true } })
      .sort({ createdAt: -1 }).limit(60).toArray();
    const token = clean(request.nextUrl.searchParams.get('token'), 120);
    let prompt = null;
    if (token) {
      const order = await db.collection('orders').findOne({
        reviewToken: token, status: 'completed', source: 'website'
      }, { projection: { _id: 1, orderNumber: 1, reviewSubmittedAt: 1 } });
      if (order && !order.reviewSubmittedAt) {
        prompt = { orderId: String(order._id), orderNumber: order.orderNumber };
      }
    }
    return NextResponse.json({ ok: true, reviews: reviews.map((r) => ({
      id: String(r._id), name: r.name, comment: r.comment,
      ...(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 ? { rating: r.rating } : {}),
      createdAt: r.createdAt
    })), prompt });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر تحميل آراء العملاء.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { token?: string; name?: string; comment?: string; rating?: number };
    const token = clean(body.token, 120);
    const name = clean(body.name, 80);
    const comment = clean(body.comment, 700);
    const rating = body.rating;
    if (!/^[a-f0-9-]{36}$/i.test(token) || name.length < 2 || comment.length < 3) {
      return NextResponse.json({ ok: false, error: 'اكتب الاسم والتعليق بشكل صحيح.' }, { status: 400 });
    }
    if (rating !== undefined && rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json({ ok: false, error: 'التقييم النجمي غير صالح.' }, { status: 400 });
    }
    const db = await getDb();
    const orders = db.collection('orders');
    const order = await orders.findOne({ reviewToken: token, source: 'website', status: 'completed' });
    if (!order) return NextResponse.json({ ok: false, error: 'التقييم متاح بعد إكمال الطلب فقط.' }, { status: 403 });
    if (order.reviewSubmittedAt) return NextResponse.json({ ok: false, error: 'تم إرسال تقييم لهذا الطلب من قبل.' }, { status: 409 });
    const existing = await db.collection('customer_reviews').findOne({ orderId: String(order._id) });
    if (existing) return NextResponse.json({ ok: false, error: 'تم إرسال تقييم لهذا الطلب من قبل.' }, { status: 409 });
    await db.collection('customer_reviews').insertOne({
      orderId: String(order._id), orderNumber: order.orderNumber, name, comment,
      ...(rating ? { rating } : {}), createdAt: new Date(), visible: true
    });
    await orders.updateOne({ _id: order._id, reviewToken: token, reviewSubmittedAt: { $exists: false } }, {
      $set: { reviewSubmittedAt: new Date() }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر حفظ التقييم الآن.' }, { status: 500 });
  }
}
