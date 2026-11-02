import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ensureDefaultProducts, findStoredProduct, serializeStoredProduct } from '@/lib/catalog';
import { getProduct } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProductRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: ProductRouteContext) {
  const { id } = await params;
  const builtIn = getProduct(id);

  if (!process.env.MONGODB_URI) {
    return builtIn
      ? NextResponse.json({ product: builtIn }, { headers: { 'cache-control': 'no-store' } })
      : NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    const db = await getDb();
    await ensureDefaultProducts(db);
    const stored = await findStoredProduct(db, id);
    if (stored) {
      return NextResponse.json(
        { product: serializeStoredProduct(stored) },
        { headers: { 'cache-control': 'no-store' } }
      );
    }

    if (builtIn) {
      const deletedSeed = await db.collection('products').findOne(
        { seedId: id, deleted: true },
        { projection: { _id: 1 } }
      );
      if (deletedSeed) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
    }

    return builtIn
      ? NextResponse.json({ product: builtIn }, { headers: { 'cache-control': 'no-store' } })
      : NextResponse.json({ error: 'Product not found' }, { status: 404 });
  } catch (error) {
    console.error('Product API refresh failed:', error instanceof Error ? error.message : 'Unknown error');
    // A database outage must not turn a previously visible built-in product
    // into a blocking error page.
    return builtIn
      ? NextResponse.json({ product: builtIn }, { headers: { 'cache-control': 'no-store' } })
      : NextResponse.json({ error: 'Product temporarily unavailable' }, { status: 503 });
  }
}
