import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const noStore = { 'cache-control': 'no-store, max-age=0' };
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ banners: [] }, { headers: noStore });
  }

  try {
    const db = await getDb();
    const banners = await db.collection('store_banners')
      .find({})
      .sort({ createdAt: 1, _id: 1 })
      .limit(12)
      .toArray();

    return NextResponse.json({
      banners: banners.map((banner) => ({
        id: String(banner._id),
        imageUrl: '/api/store-banners/' + String(banner._id) + '/image',
        alt: typeof banner.alt === 'string' && banner.alt.trim() ? banner.alt : 'عرض من أرض الجوال'
      }))
    }, { headers: noStore });
  } catch (error) {
    console.error('Store banners load failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ banners: [] }, { headers: noStore });
  }
}
