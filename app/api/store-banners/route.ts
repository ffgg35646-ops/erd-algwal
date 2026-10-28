import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_ONLINE_BANNERS = [
  {
    imageUrl: 'https://images.unsplash.com/photo-1726732946451-98690db97aae?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'تشكيلة آيفون بألوان مختلفة'
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1608547492981-3327ee04cafd?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'آيفون بتصميم أنيق'
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1639546196487-972721434b13?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'سماعات AirPods'
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1602507234750-44911b524317?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'سماعات لاسلكية وملحقاتها'
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1624096104992-9b4fa3a279dd?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'ساعة ذكية'
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1621715225783-b361297d0e8f?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'جهاز آيباد'
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1578950435899-d1c1bf932ab2?auto=format&fit=crop&crop=entropy&w=1800&h=600&q=85',
    alt: 'جهاز ماك بوك'
  }
] as const;

const SLIDER_SEED_MARKER_ID = 'store_banners_default_seed_v1';

function isHttpsImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET() {
  const noStore = { 'cache-control': 'no-store, max-age=0' };
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({
      banners: DEFAULT_ONLINE_BANNERS.map((banner, index) => ({
        id: 'default-' + (index + 1),
        imageUrl: banner.imageUrl,
        alt: banner.alt
      }))
    }, { headers: noStore });
  }

  try {
    const db = await getDb();
    const bannerCollection = db.collection('store_banners');
    const existingCount = await bannerCollection.countDocuments({});

    // Seed once so these online placeholder images can later be deleted from the Telegram admin bot.
    const seedClaim = await db.collection('store_settings').updateOne(
      { _id: SLIDER_SEED_MARKER_ID },
      { $setOnInsert: { createdAt: new Date(), purpose: 'one-time slider image seed' } },
      { upsert: true }
    );

    if (seedClaim.upsertedCount === 1 && existingCount < DEFAULT_ONLINE_BANNERS.length) {
      const remaining = DEFAULT_ONLINE_BANNERS.length - existingCount;
      const seedTime = Date.now();
      await bannerCollection.insertMany(
        DEFAULT_ONLINE_BANNERS.slice(0, remaining).map((banner, index) => ({
          ...banner,
          createdAt: new Date(seedTime + index),
          createdBySystem: true
        }))
      );
    }

    const banners = await bannerCollection
      .find({})
      .sort({ createdAt: 1, _id: 1 })
      .limit(12)
      .toArray();

    return NextResponse.json({
      banners: banners.map((banner) => ({
        id: String(banner._id),
        imageUrl: isHttpsImageUrl(banner.imageUrl)
          ? banner.imageUrl
          : '/api/store-banners/' + String(banner._id) + '/image',
        alt: typeof banner.alt === 'string' && banner.alt.trim() ? banner.alt : 'عرض من أرض الجوال'
      }))
    }, { headers: noStore });
  } catch (error) {
    console.error('Store banners load failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      banners: DEFAULT_ONLINE_BANNERS.map((banner, index) => ({
        id: 'default-' + (index + 1),
        imageUrl: banner.imageUrl,
        alt: banner.alt
      }))
    }, { headers: noStore });
  }
}
