import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoreBrandingSettings = {
  _id: string;
  logoFileId?: string;
};

type TelegramFile = { file_path?: string };

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
    if (!file.file_path) {
      return new NextResponse('Store logo not available', { status: 404 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const telegramResponse = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      cache: 'no-store'
    });
    if (!telegramResponse.ok || !telegramResponse.body) {
      return new NextResponse('Unable to load store logo', { status: 502 });
    }

    const headers = new Headers();
    headers.set('content-type', telegramResponse.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'no-store, max-age=0');
    headers.set('x-content-type-options', 'nosniff');
    return new NextResponse(telegramResponse.body, { status: 200, headers });
  } catch (error) {
    console.error('Store logo load failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load store logo', { status: 500 });
  }
}
