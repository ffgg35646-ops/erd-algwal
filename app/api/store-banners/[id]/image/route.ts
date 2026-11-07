import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramFile = { file_path?: string };
type StoredBannerImage = {
  fileId?: string;
  imageDataBase64?: string;
  contentType?: string;
};

const MAX_SLIDER_IMAGE_BYTES = 8 * 1024 * 1024;

function imageHeaders(contentType: string) {
  return {
    'content-type': contentType,
    'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    'x-content-type-options': 'nosniff'
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id) || new ObjectId(id).toHexString() !== id.toLowerCase()) {
    return new NextResponse('Invalid image id', { status: 400 });
  }
  if (!process.env.MONGODB_URI) {
    return new NextResponse('Slider image service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const banner = await db.collection<StoredBannerImage>('store_banners').findOne({ _id: new ObjectId(id) });
    if (!banner) return new NextResponse('Image not found', { status: 404 });

    // New uploads are stored with their image bytes, so storefront rendering no
    // longer depends on Telegram retaining a file_id or using the same bot token.
    if (typeof banner.imageDataBase64 === 'string' && banner.imageDataBase64) {
      const imageBytes = Buffer.from(banner.imageDataBase64, 'base64');
      if (!imageBytes.length || imageBytes.length > MAX_SLIDER_IMAGE_BYTES) {
        return new NextResponse('Stored image is invalid', { status: 404 });
      }
      const contentType = typeof banner.contentType === 'string' && banner.contentType.startsWith('image/')
        ? banner.contentType
        : 'image/jpeg';
      return new NextResponse(imageBytes, { status: 200, headers: imageHeaders(contentType) });
    }

    // Backward compatibility: fetch old slider records once, then cache the
    // downloaded bytes in MongoDB for all later requests.
    const fileId = typeof banner.fileId === 'string' ? banner.fileId : '';
    if (!fileId) return new NextResponse('Image not found', { status: 404 });
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return new NextResponse('Legacy slider image requires Telegram configuration', { status: 503 });
    }

    const file = await telegramApi<TelegramFile>('getFile', { file_id: fileId });
    if (!file.file_path) return new NextResponse('Image not available', { status: 404 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok || !response.body) {
      return new NextResponse('Unable to load image', { status: 502 });
    }

    const responseContentType = response.headers.get('content-type') || 'image/jpeg';
    if (!responseContentType.startsWith('image/')) {
      return new NextResponse('Telegram returned a non-image file', { status: 502 });
    }
    const imageBytes = Buffer.from(await response.arrayBuffer());
    if (!imageBytes.length || imageBytes.length > MAX_SLIDER_IMAGE_BYTES) {
      return new NextResponse('Image is empty or larger than 8 MB', { status: 413 });
    }

    await db.collection<StoredBannerImage>('store_banners').updateOne(
      { _id: new ObjectId(id), imageDataBase64: { $exists: false } },
      {
        $set: {
          imageDataBase64: imageBytes.toString('base64'),
          contentType: responseContentType,
          imageSize: imageBytes.length
        }
      }
    );

    return new NextResponse(imageBytes, {
      status: 200,
      headers: imageHeaders(responseContentType)
    });
  } catch (error) {
    console.error('Slider image load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load image', { status: 500 });
  }
}
