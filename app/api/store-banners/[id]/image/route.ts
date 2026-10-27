import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramFile = { file_path?: string };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id) || new ObjectId(id).toHexString() !== id.toLowerCase()) {
    return new NextResponse('Invalid image id', { status: 400 });
  }
  if (!process.env.MONGODB_URI || !process.env.TELEGRAM_BOT_TOKEN) {
    return new NextResponse('Slider image service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const banner = await db.collection('store_banners').findOne({ _id: new ObjectId(id) });
    const fileId = typeof banner?.fileId === 'string' ? banner.fileId : '';
    if (!fileId) return new NextResponse('Image not found', { status: 404 });

    const file = await telegramApi<TelegramFile>('getFile', { file_id: fileId });
    if (!file.file_path) return new NextResponse('Image not available', { status: 404 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'force-cache',
      next: { revalidate: 3600 }
    });
    if (!response.ok || !response.body) {
      return new NextResponse('Unable to load image', { status: 502 });
    }

    const headers = new Headers();
    headers.set('content-type', response.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
    return new NextResponse(response.body, { status: 200, headers });
  } catch (error) {
    console.error('Slider image load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load image', { status: 500 });
  }
}
