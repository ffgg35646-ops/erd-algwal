import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { findStoredProduct, isBlockedCatalogImage } from '@/lib/catalog';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramFile = { file_path?: string };
type StoredProductImageAsset = {
  productId: string;
  fileId: string;
  imageDataBase64: string;
  contentType: string;
  imageSize: number;
};

const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;

function imageResponse(bytes: Buffer, contentType: string) {
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.length),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff'
    }
  });
}

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
    if (!imageValue || isBlockedCatalogImage(imageValue) || !product) {
      return new NextResponse('Image not found', { status: 404 });
    }

    // Some importers store HTTP(S) image URLs instead of Telegram file IDs.
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

    const productId = product._id.toString();
    const assets = db.collection<StoredProductImageAsset>('product_image_assets');
    const cachedAsset = await assets.findOne({ productId, fileId: imageValue });
    if (cachedAsset?.imageDataBase64) {
      const cachedBytes = Buffer.from(cachedAsset.imageDataBase64, 'base64');
      if (
        cachedBytes.length > 0 &&
        cachedBytes.length <= MAX_PRODUCT_IMAGE_BYTES &&
        (!cachedAsset.imageSize || cachedBytes.length === cachedAsset.imageSize)
      ) {
        const contentType = cachedAsset.contentType?.startsWith('image/')
          ? cachedAsset.contentType
          : 'image/jpeg';
        return imageResponse(cachedBytes, contentType);
      }
    }

    // Legacy Telegram file IDs are migrated to MongoDB on the first successful
    // request. After that, image delivery no longer depends on Telegram.
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return new NextResponse('Legacy Telegram image is not cached yet', { status: 503 });

    const file = await telegramApi<TelegramFile>('getFile', { file_id: imageValue });
    if (!file.file_path) return new NextResponse('Image not available', { status: 404 });

    const telegramResponse = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    });
    if (!telegramResponse.ok || !telegramResponse.body) {
      return new NextResponse('Unable to load image', { status: 502 });
    }

    const imageBytes = Buffer.from(await telegramResponse.arrayBuffer());
    if (!imageBytes.length || imageBytes.length > MAX_PRODUCT_IMAGE_BYTES) {
      return new NextResponse('Image is empty or larger than 8 MB', { status: 413 });
    }
    const responseContentType = telegramResponse.headers.get('content-type') || 'image/jpeg';
    const contentType = responseContentType.startsWith('image/') ? responseContentType : 'image/jpeg';

    await assets.updateOne(
      { productId, fileId: imageValue },
      {
        $setOnInsert: {
          productId,
          fileId: imageValue,
          imageDataBase64: imageBytes.toString('base64'),
          contentType,
          imageSize: imageBytes.length,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    return imageResponse(imageBytes, contentType);
  } catch (error) {
    console.error('Product image load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load image', { status: 500 });
  }
}
