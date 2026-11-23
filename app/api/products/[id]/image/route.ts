import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { findStoredProduct, isBlockedCatalogImage } from '@/lib/catalog';
import { telegramApi } from '@/lib/telegram';
import { fetchRemoteImage } from '@/lib/remote-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramFile = { file_path?: string };
type StoredMedia = {
  imageDataBase64?: string;
  contentType?: string;
  imageSize?: number;
};

type StoredProductImageAsset = {
  productId?: string | ObjectId;
  fileId?: string;
  imageDataBase64?: string;
  contentType?: string;
  imageSize?: number;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function safeImageContentType(value: string | undefined) {
  return value && /^image\/(jpeg|png|webp|gif|bmp|avif)$/i.test(value)
    ? value
    : 'image/jpeg';
}

function imageResponse(bytes: Buffer, contentType: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    return new NextResponse('Stored image is empty or too large', { status: 422 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': safeImageContentType(contentType),
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      'x-content-type-options': 'nosniff'
    }
  });
}

function decodeStoredImage(value: string, fallbackContentType: string) {
  const dataUrl = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (dataUrl) {
    return {
      bytes: Buffer.from(dataUrl[2].replace(/\s/g, ''), 'base64'),
      contentType: safeImageContentType(dataUrl[1])
    };
  }
  return {
    bytes: Buffer.from(value, 'base64'),
    contentType: safeImageContentType(fallbackContentType)
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const color = request.nextUrl.searchParams.get('color');
  const source = request.nextUrl.searchParams.get('source');
  const index = Number(request.nextUrl.searchParams.get('index') || '0');
  if (source !== null && source !== 'cover') {
    return NextResponse.json({ error: 'Invalid image source' }, { status: 400 });
  }
  if (source !== 'cover' && color === null && (!Number.isInteger(index) || index < 0 || index > 10)) {
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
    if (!product) return new NextResponse('Product not found', { status: 404 });

    const imageValue = source === 'cover'
      ? product.imageUrl
      : color !== null
        ? product.colorImages?.[color]
        : product.images?.[index];

    const mediaId = source === 'cover'
      ? product.imageUrlMediaId
      : color !== null
        ? product.colorImageMediaIds?.[color]
        : product.imageMediaIds?.[index];

    const directImageData = source === 'cover'
      ? product.imageUrlDataBase64
      : color !== null
        ? product.colorImagesDataBase64?.[color]
        : product.imagesDataBase64?.[index];

    const directContentType = color !== null
      ? product.colorImageContentTypes?.[color]
      : source === 'cover'
        ? product.imageUrlContentType
        : product.imageContentTypes?.[index];

    if (
      (typeof imageValue === 'string' && isBlockedCatalogImage(imageValue))
      || (!imageValue && !mediaId && !directImageData)
    ) {
      return new NextResponse('Image not found', { status: 404 });
    }

    // Durable admin uploads are stored as separate MongoDB media records.
    if (mediaId && ObjectId.isValid(mediaId)) {
      const media = await db.collection<StoredMedia>('store_media').findOne({
        _id: new ObjectId(mediaId)
      });
      if (media?.imageDataBase64) {
        const decoded = decodeStoredImage(media.imageDataBase64, media.contentType || 'image/jpeg');
        if (decoded.bytes.length) return imageResponse(decoded.bytes, decoded.contentType);
      }
    }

    // Older Telegram-admin deployments stored uploaded product image bytes in
    // product_image_assets, keyed by productId + Telegram fileId. Read that
    // durable copy before attempting a Telegram download so admin images remain
    // available even when the bot token or Telegram file cache changes.
    if (typeof imageValue === 'string' && imageValue) {
      const adminAsset = await db.collection<StoredProductImageAsset>('product_image_assets').findOne({
        fileId: imageValue,
        $or: [
          { productId: product._id.toHexString() },
          { productId: product._id }
        ]
      });
      if (adminAsset?.imageDataBase64) {
        const decoded = decodeStoredImage(adminAsset.imageDataBase64, adminAsset.contentType || 'image/jpeg');
        if (decoded.bytes.length) return imageResponse(decoded.bytes, decoded.contentType);
      }
    }

    // Images inserted directly into MongoDB may also be stored as base64
    // data URLs or as explicit base64 fields.
    if (typeof directImageData === 'string' && directImageData.length > 0) {
      const decoded = decodeStoredImage(directImageData, directContentType || 'image/jpeg');
      if (decoded.bytes.length) return imageResponse(decoded.bytes, decoded.contentType);
    }
    if (typeof imageValue === 'string' && imageValue.startsWith('data:image/')) {
      const decoded = decodeStoredImage(imageValue, directContentType || 'image/jpeg');
      if (decoded.bytes.length) return imageResponse(decoded.bytes, decoded.contentType);
    }
    if (
      typeof imageValue === 'string'
      && imageValue.length > 256
      && /^[a-z0-9+/_=-]+$/i.test(imageValue)
    ) {
      const decoded = decodeStoredImage(imageValue, directContentType || 'image/jpeg');
      if (decoded.bytes.length) return imageResponse(decoded.bytes, decoded.contentType);
    }

    // Preserve direct external URLs and local public paths without involving Telegram.
    if (typeof imageValue === 'string') {
      try {
        const imageUrl = new URL(imageValue);
        if (
          (imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:')
          && !imageUrl.username
          && !imageUrl.password
        ) {
          return fetchRemoteImage(imageUrl.toString());
        }
      } catch {
        if (imageValue.startsWith('/') && !imageValue.startsWith('//')) {
          const response = NextResponse.redirect(new URL(imageValue, request.url), 302);
          response.headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
          return response;
        }
        // A non-URL value is a legacy Telegram file_id below.
      }
    }

    // Legacy migration: download an older Telegram-only image once, persist it
    // in MongoDB, attach its media ID to the product, and serve the DB copy.
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || typeof imageValue !== 'string') {
      return new NextResponse('Image is not stored in MongoDB and Telegram migration is unavailable', { status: 503 });
    }

    const file = await telegramApi<TelegramFile>('getFile', { file_id: imageValue });
    if (!file.file_path) return new NextResponse('Image not available', { status: 404 });

    const telegramResponse = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    });
    if (!telegramResponse.ok || !telegramResponse.body) {
      return new NextResponse(`Unable to load legacy image (${telegramResponse.status})`, { status: 502 });
    }

    const imageBytes = Buffer.from(await telegramResponse.arrayBuffer());
    const contentType = safeImageContentType(telegramResponse.headers.get('content-type') || undefined);
    if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
      return new NextResponse('Legacy image is empty or larger than 8 MB', { status: 422 });
    }

    const mediaObjectId = new ObjectId();
    await db.collection('store_media').insertOne({
      _id: mediaObjectId,
      imageDataBase64: imageBytes.toString('base64'),
      contentType,
      imageSize: imageBytes.length,
      telegramFileId: imageValue,
      source: 'telegram-legacy-migration',
      purpose: source === 'cover' ? 'product-cover' : color !== null ? 'product-color' : 'product-gallery',
      createdAt: new Date()
    });

    if (source === 'cover') {
      await db.collection('products').updateOne(
        { _id: product._id },
        { $set: { imageUrlMediaId: mediaObjectId.toHexString(), updatedAt: new Date() } }
      );
    } else if (color !== null) {
      await db.collection('products').updateOne(
        { _id: product._id },
        { $set: { colorImageMediaIds: { ...(product.colorImageMediaIds || {}), [color]: mediaObjectId.toHexString() }, updatedAt: new Date() } }
      );
    } else {
      const mediaIds = [...(product.imageMediaIds || [])];
      mediaIds[index] = mediaObjectId.toHexString();
      await db.collection('products').updateOne(
        { _id: product._id },
        { $set: { imageMediaIds: mediaIds, updatedAt: new Date() } }
      );
    }

    return imageResponse(imageBytes, contentType);
  } catch (error) {
    console.error('Product image load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load image', { status: 500 });
  }
}
