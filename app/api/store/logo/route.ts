import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getDb } from '@/lib/mongodb';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoreBrandingSettings = {
  _id: string;
  logoFileId?: string;
  logoBackgroundMode?: 'with' | 'without';
};

type TelegramFile = { file_path?: string };

async function removeFlatLogoBackground(source: Buffer): Promise<Buffer> {
  const decoded = await sharp(source)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = decoded;
  const { width, height, channels } = info;
  if (channels !== 4 || width < 2 || height < 2) return source;

  const buckets = new Map<string, { red: number; green: number; blue: number; count: number }>();
  let sampleCount = 0;
  const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 260));
  const addEdgeSample = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    if (data[offset + 3] < 180) return;
    const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
    const key = [red >> 5, green >> 5, blue >> 5].join(':');
    const bucket = buckets.get(key) || { red: 0, green: 0, blue: 0, count: 0 };
    bucket.red += red; bucket.green += green; bucket.blue += blue; bucket.count += 1;
    buckets.set(key, bucket); sampleCount += 1;
  };

  for (let x = 0; x < width; x += sampleStep) {
    addEdgeSample(x, 0); addEdgeSample(x, height - 1);
  }
  for (let y = 0; y < height; y += sampleStep) {
    addEdgeSample(0, y); addEdgeSample(width - 1, y);
  }

  let dominant: { red: number; green: number; blue: number; count: number } | undefined;
  for (const bucket of buckets.values()) if (!dominant || bucket.count > dominant.count) dominant = bucket;
  if (!dominant || sampleCount === 0 || dominant.count / sampleCount < 0.25) return source;

  const backgroundRed = dominant.red / dominant.count;
  const backgroundGreen = dominant.green / dominant.count;
  const backgroundBlue = dominant.blue / dominant.count;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0, queueEnd = 0;
  const addIfBackground = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;
    const offset = pixelIndex * 4;
    if (data[offset + 3] < 16) return;
    const red = data[offset] - backgroundRed;
    const green = data[offset + 1] - backgroundGreen;
    const blue = data[offset + 2] - backgroundBlue;
    if (red * red + green * green + blue * blue <= 84 * 84) queue[queueEnd++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    addIfBackground(x);
    addIfBackground((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    addIfBackground(y * width);
    addIfBackground(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart++];
    const offset = pixelIndex * 4;
    const red = data[offset] - backgroundRed;
    const green = data[offset + 1] - backgroundGreen;
    const blue = data[offset + 2] - backgroundBlue;
    const distance = Math.sqrt(red * red + green * green + blue * blue);
    data[offset + 3] = distance <= 58
      ? 0
      : Math.round(data[offset + 3] * Math.min(1, (distance - 58) / 26));

    const x = pixelIndex % width, y = Math.floor(pixelIndex / width);
    if (x > 0) addIfBackground(pixelIndex - 1);
    if (x + 1 < width) addIfBackground(pixelIndex + 1);
    if (y > 0) addIfBackground(pixelIndex - width);
    if (y + 1 < height) addIfBackground(pixelIndex + width);
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

export async function GET() {
  if (!process.env.MONGODB_URI || !process.env.TELEGRAM_BOT_TOKEN) {
    return new NextResponse('Store logo service not configured', { status: 503 });
  }

  try {
    const db = await getDb();
    const settings = await db.collection<StoreBrandingSettings>('store_settings')
      .findOne({ _id: 'branding' });
    if (!settings?.logoFileId) {
      return new NextResponse('Custom store logo not configured', { status: 404 });
    }

    const file = await telegramApi<TelegramFile>('getFile', { file_id: settings.logoFileId });
    if (!file.file_path) return new NextResponse('Store logo not available', { status: 404 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const telegramResponse = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'no-store'
    });
    if (!telegramResponse.ok) return new NextResponse('Unable to load store logo', { status: 502 });

    let image: Buffer<ArrayBufferLike> = Buffer.from(await telegramResponse.arrayBuffer());
    const withoutBackground = settings.logoBackgroundMode === 'without';
    if (withoutBackground) image = await removeFlatLogoBackground(image);

    return new NextResponse(new Uint8Array(image), {
      status: 200,
      headers: {
        'content-type': withoutBackground ? 'image/png' : (telegramResponse.headers.get('content-type') || 'image/jpeg'),
        'x-store-logo-background': withoutBackground ? 'without' : settings.logoBackgroundMode === 'with' ? 'with' : 'legacy',
        'cache-control': 'no-store, max-age=0',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Store logo load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load store logo', { status: 500 });
  }
}
