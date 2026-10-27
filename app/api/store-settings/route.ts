import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ whatsappNumber: '' }, { headers: { 'cache-control': 'no-store' } });
  }

  try {
    const db = await getDb();
    const settings = await db.collection<{ _id: string; whatsappNumber?: string }>('store_settings').findOne({ _id: 'contact' });
    const whatsappNumber = typeof settings?.whatsappNumber === 'string'
      ? settings.whatsappNumber
      : '';
    return NextResponse.json(
      { whatsappNumber },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    console.error('Store settings read failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ whatsappNumber: '' }, { headers: { 'cache-control': 'no-store' } });
  }
}
