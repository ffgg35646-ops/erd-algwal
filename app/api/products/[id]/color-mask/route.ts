import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { findStoredProduct, type StoredProduct } from '@/lib/catalog';
import { isPhoneCaseProduct } from '@/lib/case-color-preview';
import type { ProductColorMask } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EditorSession = {
  _id: string;
  productId: string;
  telegramUserId: number;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
};

type SubmittedMask = {
  encoding?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  data?: string;
};

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function getAuthorizedProduct(id: string, token: string) {
  if (!ObjectId.isValid(id) || new ObjectId(id).toHexString() !== id.toLowerCase()) {
    return { error: 'معرّف المنتج غير صالح.', status: 400 as const };
  }
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return { error: 'رابط أداة التحديد غير صالح.', status: 401 as const };
  }

  const db = await getDb();
  const session = await db.collection<EditorSession>('case_mask_editor_sessions').findOne({
    _id: tokenHash(token),
    productId: id,
    expiresAt: { $gt: new Date() },
    usedAt: { $exists: false }
  });
  if (!session) return { error: 'انتهت صلاحية الرابط أو تم استخدامه. افتح رابطًا جديدًا من بوت الإدارة.', status: 401 as const };

  const product = await findStoredProduct(db, id);
  if (!product || !product.images?.[0]) return { error: 'صورة غلاف المنتج غير متاحة.', status: 404 as const };
  if (!isPhoneCaseProduct(product.name, product.category, product.details)) {
    return { error: 'الأداة مخصصة لمنتجات الجرابات والكفرات فقط.', status: 400 as const };
  }
  if (!product.colors?.length) return { error: 'أضف ألوان المنتج من بوت الإدارة أولًا.', status: 400 as const };

  return { db, session, product };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const token = request.nextUrl.searchParams.get('token') || '';
    const result = await getAuthorizedProduct(id, token);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      product: {
        productName: result.product.name,
        imageUrl: '/api/products/' + encodeURIComponent(id) + '/image?index=0'
      }
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Case mask editor load failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'تعذر تحميل أداة التحديد حاليًا.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { token?: string; mask?: SubmittedMask };
    const token = body.token || '';
    const result = await getAuthorizedProduct(id, token);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const mask = body.mask;
    if (
      !mask ||
      mask.encoding !== 'bit-packed-msb' ||
      !Number.isInteger(mask.width) ||
      !Number.isInteger(mask.height) ||
      !Number.isInteger(mask.left) ||
      !Number.isInteger(mask.top) ||
      !Number.isInteger(mask.right) ||
      !Number.isInteger(mask.bottom) ||
      !mask.data ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(mask.data)
    ) {
      return NextResponse.json({ error: 'بيانات القناع غير صالحة.' }, { status: 400 });
    }

    const width = mask.width as number;
    const height = mask.height as number;
    const left = mask.left as number;
    const top = mask.top as number;
    const right = mask.right as number;
    const bottom = mask.bottom as number;
    const pixels = width * height;
    if (
      width < 1 || height < 1 || left < 0 || top < 0 ||
      right - left !== width || bottom - top !== height ||
      pixels > 4_000_000 || right > 12000 || bottom > 12000
    ) {
      return NextResponse.json({ error: 'حدود التحديد غير مناسبة. قلّل مساحة التحديد واجعلها على الكفر فقط.' }, { status: 400 });
    }

    const packed = Buffer.from(mask.data, 'base64');
    if (packed.length !== Math.ceil(pixels / 8) || packed.length > 600_000 || !packed.some((value) => value !== 0)) {
      return NextResponse.json({ error: 'ملف التحديد فارغ أو حجمه غير صالح.' }, { status: 400 });
    }

    const consumed = await result.db.collection<EditorSession>('case_mask_editor_sessions').updateOne(
      { _id: result.session._id, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } }
    );
    if (consumed.modifiedCount !== 1) {
      return NextResponse.json({ error: 'انتهت صلاحية الرابط أو تم استخدامه بالفعل. افتح رابطًا جديدًا من البوت.' }, { status: 401 });
    }

    const colorMask: ProductColorMask = {
      version: 1,
      sourceColor: result.product.colorMask?.sourceColor || result.product.colors[0],
      encoding: 'bit-packed-msb',
      width,
      height,
      left,
      top,
      right,
      bottom,
      data: packed.toString('base64'),
      model: 'manual-brush-v1',
      generatedAt: new Date()
    };

    const saved = await result.db.collection<StoredProduct>('products').updateOne(
      { _id: new ObjectId(id), deleted: { $ne: true } },
      { $set: { colorMask, updatedAt: new Date() } }
    );
    if (saved.modifiedCount !== 1 && saved.matchedCount !== 1) {
      return NextResponse.json({ error: 'لم يتم حفظ القناع لأن المنتج لم يعد متاحًا.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Case mask save failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'تعذر حفظ القناع حاليًا. افتح رابطًا جديدًا وحاول مرة أخرى.' }, { status: 500 });
  }
}
