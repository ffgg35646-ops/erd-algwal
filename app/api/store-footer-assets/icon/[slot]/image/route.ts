import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FooterSettings = {
  _id: string;
  iconOneImageDataBase64?: string;
  iconOneContentType?: string;
  iconOneImageSize?: number;
  iconTwoImageDataBase64?: string;
  iconTwoContentType?: string;
  iconTwoImageSize?: number;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slot: string }> }
) {
  const { slot } = await params;
  if (slot !== 'one' && slot !== 'two') {
    return new NextResponse('Footer icon not found', { status: 404 });
  }
  if (!process.env.MONGODB_URI) {
    return new NextResponse('Footer icon service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const settings = await db.collection<FooterSettings>('store_settings').findOne({ _id: 'footer' });
    const imageData = slot === 'one'
      ? settings?.iconOneImageDataBase64
      : settings?.iconTwoImageDataBase64;
    const contentType = slot === 'one'
      ? settings?.iconOneContentType
      : settings?.iconTwoContentType;
    const imageSize = slot === 'one'
      ? settings?.iconOneImageSize
      : settings?.iconTwoImageSize;
    if (!imageData) return new NextResponse('Footer icon not found', { status: 404 });

    const bytes = Buffer.from(imageData, 'base64');
    if (!bytes.length || bytes.length > 1024 * 1024 || (imageSize && bytes.length !== imageSize)) {
      return new NextResponse('Footer icon image is invalid', { status: 422 });
    }

    const headers = new Headers();
    headers.set('content-type', contentType?.startsWith('image/') ? contentType : 'image/jpeg');
    headers.set('content-length', String(bytes.length));
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('x-content-type-options', 'nosniff');
    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  } catch (error) {
    console.error('Footer icon load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load footer icon', { status: 500 });
  }
}
