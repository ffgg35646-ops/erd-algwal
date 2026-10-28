import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const DEMO_REVIEW_NAMES = [
  'فهد العتيبي', 'نورة القحطاني', 'عبدالله الحربي', 'سارة الدوسري',
  'تركي الغامدي', 'ريم المطيري', 'خالد الزهراني', 'الجوهرة العنزي',
  'فيصل الشهري', 'منيرة السبيعي', 'مشعل الشمري', 'لولوة المالكي'
];

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const reviews = await db.collection('customer_reviews')
      .find({ visible: { $ne: false } })
      .sort({ createdAt: -1 }).limit(60).toArray();

    const token = clean(request.nextUrl.searchParams.get('token'), 120);
    let prompt = null;
    if (token) {
      const order = await db.collection('orders').findOne({
        reviewToken: token,
        status: 'completed',
        source: 'website',
        reviewSubmittedAt: { $exists: false }
      }, { projection: { _id: 1, orderNumber: 1 }, sort: { updatedAt: -1, createdAt: -1 } });

      if (order) {
        const alreadyReviewed = await db.collection('customer_reviews').findOne({ orderId: String(order._id) });
        if (!alreadyReviewed) prompt = { orderId: String(order._id), orderNumber: order.orderNumber };
      }
    }

    let demoNameIndex = 0;
    return NextResponse.json({ ok: true, reviews: reviews.map((r) => ({
      id: String(r._id), name: r.isDemo === true ? DEMO_REVIEW_NAMES[demoNameIndex++ % DEMO_REVIEW_NAMES.length] : r.name, comment: r.comment, isDemo: r.isDemo === true,
      ...(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 ? { rating: r.rating } : {}),
      createdAt: r.createdAt
    })), prompt });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر تحميل آراء العملاء.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { token?: string; orderId?: string; name?: string; comment?: string; rating?: number };
    const token = clean(body.token, 120);
    const orderId = clean(body.orderId, 40);
    const name = clean(body.name, 80);
    const comment = clean(body.comment, 700);
    const rating = body.rating;

    if (!/^[a-f0-9-]{36}$/i.test(token) || !ObjectId.isValid(orderId) || name.length < 2 || comment.length < 3) {
      return NextResponse.json({ ok: false, error: 'اكتب الاسم والتعليق بشكل صحيح.' }, { status: 400 });
    }
    if (rating !== undefined && rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json({ ok: false, error: 'التقييم النجمي غير صالح.' }, { status: 400 });
    }

    const db = await getDb();
    const orders = db.collection('orders');
    const orderObjectId = new ObjectId(orderId);
    const order = await orders.findOne({
      _id: orderObjectId, reviewToken: token, source: 'website', status: 'completed',
      reviewSubmittedAt: { $exists: false }
    });
    if (!order) return NextResponse.json({ ok: false, error: 'التقييم متاح للطلب المكتمل الذي لم يُقيّم من قبل فقط.' }, { status: 403 });

    const reviews = db.collection('customer_reviews');
    const existing = await reviews.findOne({ orderId: String(order._id) });
    if (existing) {
      await orders.updateOne({ _id: order._id }, { $set: { reviewSubmittedAt: new Date() } });
      return NextResponse.json({ ok: false, error: 'تم إرسال تقييم لهذا الطلب من قبل.' }, { status: 409 });
    }

    const claimed = await orders.updateOne({
      _id: order._id, reviewToken: token, status: 'completed',
      reviewSubmittedAt: { $exists: false }
    }, { $set: { reviewSubmittedAt: new Date() } });
    if (!claimed.modifiedCount) {
      return NextResponse.json({ ok: false, error: 'تم إرسال تقييم لهذا الطلب من قبل.' }, { status: 409 });
    }

    try {
      await reviews.insertOne({
        orderId: String(order._id), orderNumber: order.orderNumber, name, comment,
        ...(rating ? { rating } : {}), createdAt: new Date(), visible: true
      });
    } catch (error) {
      await orders.updateOne({ _id: order._id }, { $unset: { reviewSubmittedAt: '' } });
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'تعذر حفظ التقييم الآن.' }, { status: 500 });
  }
}
