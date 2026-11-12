import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FooterSettings = {
  _id: string;
  barcodeFileId?: string;
  imageDataBase64?: string;
  contentType?: string;
  imageSize?: number;
};
type TelegramFile = { file_path?: string };

function imageResponse(bytes: Buffer, contentType: string) {
  const headers = new Headers();
  headers.set('content-type', contentType.startsWith('image/') ? contentType : 'image/jpeg');
  headers.set('content-length', String(bytes.length));
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
}

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return new NextResponse('Barcode image service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const collection = db.collection<FooterSettings>('store_settings');
    const settings = await collection.findOne({ _id: 'footer' });

    // Serve the durable copy first. The Telegram file_id is retained only for
    // compatibility and future admin previews; the storefront no longer depends on Telegram.
    if (typeof settings?.imageDataBase64 === 'string' && settings.imageDataBase64.length > 0) {
      const bytes = Buffer.from(settings.imageDataBase64, 'base64');
      if (bytes.length > 0) {
        return imageResponse(bytes, settings.contentType || 'image/jpeg');
      }
    }

    // One-time migration for barcodes saved by older bot versions: download the
    // Telegram photo, persist its bytes in MongoDB, and serve the durable copy.
    const fileId = typeof settings?.barcodeFileId === 'string' ? settings.barcodeFileId : '';
    if (!fileId || !process.env.TELEGRAM_BOT_TOKEN) {
      return new NextResponse('Barcode image not found', { status: 404 });
    }

    const file = await telegramApi<TelegramFile>('getFile', { file_id: fileId });
    if (!file.file_path) return new NextResponse('Barcode image not available', { status: 404 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok || !response.body) {
      return new NextResponse('Unable to load barcode image', { status: 502 });
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
      return new NextResponse('Barcode image is empty or too large', { status: 422 });
    }
    const contentType = (response.headers.get('content-type') || '').startsWith('image/')
      ? response.headers.get('content-type')!
      : 'image/jpeg';

    await collection.updateOne(
      { _id: 'footer', barcodeFileId: fileId, imageDataBase64: { $exists: false } },
      { $set: { imageDataBase64: bytes.toString('base64'), contentType, imageSize: bytes.length } }
    );

    return imageResponse(bytes, contentType);
  } catch (error) {
    console.error('Footer barcode load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load barcode image', { status: 500 });
  }
}
