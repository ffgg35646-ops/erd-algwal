import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FooterSettings = { _id: string; barcodeFileId?: string };
type TelegramFile = { file_path?: string };

export async function GET() {
  if (!process.env.MONGODB_URI || !process.env.TELEGRAM_BOT_TOKEN) {
    return new NextResponse('Barcode image service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const settings = await db.collection<FooterSettings>('store_settings').findOne({ _id: 'footer' });
    const fileId = typeof settings?.barcodeFileId === 'string' ? settings.barcodeFileId : '';
    if (!fileId) return new NextResponse('Barcode image not found', { status: 404 });

    const file = await telegramApi<TelegramFile>('getFile', { file_id: fileId });
    if (!file.file_path) return new NextResponse('Barcode image not available', { status: 404 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'force-cache',
      next: { revalidate: 3600 }
    });
    if (!response.ok || !response.body) {
      return new NextResponse('Unable to load barcode image', { status: 502 });
    }

    const headers = new Headers();
    headers.set('content-type', response.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
    return new NextResponse(response.body, { status: 200, headers });
  } catch (error) {
    console.error('Footer barcode load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load barcode image', { status: 500 });
  }
}
