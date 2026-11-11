import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { listStoreBanners } from '@/lib/store-banners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function GET() {
  const noStore = { 'cache-control': 'no-store, max-age=0' };
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ banners: [], managed: true }, { headers: noStore });
  }

  try {
    const db = await getDb();
    const banners = await listStoreBanners(db);
    return NextResponse.json({ banners, managed: true }, { headers: noStore });
  } catch (error) {
    console.error('Store banners load failed:', error instanceof Error ? error.message : 'Unknown error');
    // Do not serve hard-coded old banners when the live database cannot be read.
    return NextResponse.json(
      { error: 'تعذر تحميل صور السلايدر الحالية.' },
      { status: 503, headers: noStore }
    );
  }
}
