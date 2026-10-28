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

const INITIAL_REVIEW_LAYOUT_ITEMS = [
  { comment: 'التصفح مرتب ووصلت للجهاز اللي أدور عليه بسرعة.', rating: 5 },
  { comment: 'تفاصيل الأجهزة والسعات واضحة وتساعد على الاختيار.', rating: 5 },
  { comment: 'واجهة المتجر مريحة على الجوال والتنقل بين الأقسام سهل.', rating: 5 },
  { comment: 'خيارات الألوان والتخزين واضحة قبل ما أقرر.', rating: 4 },
  { comment: 'صفحة المنتج تعرض المعلومات بشكل مختصر ومنظم.', rating: 5 },
  { comment: 'أعجبني ترتيب الجوالات والملحقات وسهولة الوصول لها.', rating: 5 },
  { comment: 'واجهة بسيطة وما احتجت وقت طويل عشان ألقى اللي أبيه.', rating: 5 },
  { comment: 'الصور وتفاصيل المنتجات تساعد على المقارنة.', rating: 4 },
  { comment: 'خطوات الطلب واضحة وسهلة المتابعة.', rating: 5 },
  { comment: 'ترتيب الأسعار ومعلومات الأجهزة واضح.', rating: 5 },
  { comment: 'التصفح لطيف وكل شيء قريب وسهل الوصول له.', rating: 5 },
  { comment: 'الأقسام مرتبة والتفاصيل مكتوبة بطريقة مريحة.', rating: 5 }
] as const;

const REVIEW_LAYOUT_SEED_MARKER = 'customer_reviews_layout_preview_seed_v4';

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const reviewCollection = db.collection('customer_reviews');
    let reviewSetupPending = false;

    // Retry incomplete seeding on later requests, but remember completion so admin deletion stays permanent.
    try {
      const settings = db.collection<{
        _id: string;
        status?: string;
        createdAt?: Date;
        completedAt?: Date;
        purpose?: string;
        seededReviewCount?: number;
      }>('store_settings');
      const seedState = await settings.findOne(
        { _id: REVIEW_LAYOUT_SEED_MARKER },
        { projection: { status: 1 } }
      );

      if (seedState?.status !== 'complete') {
        const visibleCount = await reviewCollection.countDocuments({ visible: { $ne: false } });
        const existingSeedCount = await reviewCollection.countDocuments({ layoutSeedVersion: 4 });

        // If the last attempt wrote some rows before failing, finish that same seed.
        // Otherwise only create these layout examples when no visible reviews exist.
        if (visibleCount === 0 || existingSeedCount > 0) {
          const seedTime = Date.now();
          for (let index = 0; index < INITIAL_REVIEW_LAYOUT_ITEMS.length; index += 1) {
            const item = INITIAL_REVIEW_LAYOUT_ITEMS[index];
            const stableId = new ObjectId(`6a11${'0'.repeat(16)}${String(index + 1).padStart(4, '0')}`);
            await reviewCollection.updateOne(
              { _id: stableId },
              {
                $setOnInsert: {
                  _id: stableId,
                  name: DEMO_REVIEW_NAMES[index],
                  comment: item.comment,
                  rating: item.rating,
                  isDemo: true,
                  visible: true,
                  layoutSeedVersion: 4,
                  createdAt: new Date(seedTime - index * 1000)
                }
              },
              { upsert: true }
            );
          }

          const seededVisibleCount = await reviewCollection.countDocuments({
            layoutSeedVersion: 4,
            visible: { $ne: false }
          });
          const seedComplete = seededVisibleCount === INITIAL_REVIEW_LAYOUT_ITEMS.length;
          await settings.updateOne(
            { _id: REVIEW_LAYOUT_SEED_MARKER },
            {
              $set: {
                status: seedComplete ? 'complete' : 'pending',
                ...(seedComplete ? { completedAt: new Date() } : {}),
                purpose: 'initial customer review layout',
                seededReviewCount: seededVisibleCount
              },
              $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
          );
          if (!seedComplete) reviewSetupPending = true;
        } else {
          // Don't overwrite real customer feedback when it already exists.
          await settings.updateOne(
            { _id: REVIEW_LAYOUT_SEED_MARKER },
            {
              $set: {
                status: 'complete',
                completedAt: new Date(),
                purpose: 'initial customer review layout',
                seededReviewCount: 0
              },
              $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
          );
        }
      }
    } catch (seedError) {
      // Leave the marker incomplete so a subsequent request can retry the setup.
      reviewSetupPending = true;
      console.error('Initial customer review setup skipped:', seedError instanceof Error ? seedError.message : 'Unknown error');
    }

    const reviews = await reviewCollection
      .find({ visible: { $ne: false } })
      .sort({ createdAt: -1 }).limit(60).toArray();

    if (reviews.length === 0) {
      try {
        const seedState = await db.collection<{ _id: string; status?: string; seededReviewCount?: number }>('store_settings').findOne(
          { _id: REVIEW_LAYOUT_SEED_MARKER },
          { projection: { status: 1, seededReviewCount: 1 } }
        );
        if (seedState?.status !== 'complete' || (seedState.seededReviewCount ?? 0) < INITIAL_REVIEW_LAYOUT_ITEMS.length) {
          reviewSetupPending = true;
        }
      } catch {
        reviewSetupPending = true;
      }
    }

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
    return NextResponse.json({ ok: true, reviewSetupPending, reviews: reviews.map((r) => ({
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
