import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { findStoredProduct, isBlockedCatalogImage } from '@/lib/catalog';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramFile = { file_path?: string };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const color = request.nextUrl.searchParams.get('color');
  const index = Number(request.nextUrl.searchParams.get('index') || '0');
  if (color === null && (!Number.isInteger(index) || index < 0 || index > 10)) {
    return NextResponse.json({ error: 'Invalid image index' }, { status: 400 });
  }
  if (color !== null && (!color.trim() || color.length > 80)) {
    return NextResponse.json({ error: 'Invalid product color' }, { status: 400 });
  }
  if (!process.env.MONGODB_URI) {
    return new NextResponse('Product image service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const product = await findStoredProduct(db, id);
    const imageValue = color !== null ? product?.colorImages?.[color] : product?.images?.[index];
    if (!imageValue || isBlockedCatalogImage(imageValue)) {
      return new NextResponse('Image not found', { status: 404 });
    }

    // Some importers store HTTP(S) image URLs instead of Telegram file IDs.
    // Redirect those to the public image host; only Telegram IDs use getFile.
    try {
      const imageUrl = new URL(imageValue);
      if ((imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:') && !imageUrl.username && !imageUrl.password) {
        const response = NextResponse.redirect(imageUrl, 302);
        response.headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
        return response;
      }
    } catch {
      // A non-URL value is treated as a Telegram file ID below.
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return new NextResponse('Telegram image service not configured', { status: 503 });
    const file = await telegramApi<TelegramFile>('getFile', { file_id: imageValue });
    if (!file.file_path) return new NextResponse('Image not available', { status: 404 });

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
