import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { findStoredProduct } from '@/lib/catalog';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramFile = { file_path?: string };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const index = Number(request.nextUrl.searchParams.get('index') || '0');
  if (!Number.isInteger(index) || index < 0 || index > 10) {
    return NextResponse.json({ error: 'Invalid image index' }, { status: 400 });
  }
  if (!process.env.MONGODB_URI || !process.env.TELEGRAM_BOT_TOKEN) {
    return new NextResponse('Product image service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const product = await findStoredProduct(db, id);
    const fileId = product?.images?.[index];
    if (!fileId) return new NextResponse('Image not found', { status: 404 });

    const file = await telegramApi<TelegramFile>('getFile', { file_id: fileId });
    if (!file.file_path) return new NextResponse('Image not available', { status: 404 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const telegramResponse = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'force-cache',
      next: { revalidate: 3600 }
    });
    if (!telegramResponse.ok || !telegramResponse.body) {
      return new NextResponse('Unable to load image', { status: 502 });
    }

    const headers = new Headers();
    headers.set('content-type', telegramResponse.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
    return new NextResponse(telegramResponse.body, { status: 200, headers });
  } catch (error) {
    console.error('Product image load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load image', { status: 500 });
  }
}
