import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { listCatalogProducts, listCategories } from '@/lib/catalog';
import { categories as fallbackCategories, products as fallbackProducts } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({
      categories: fallbackCategories.map((category) => ({ id: category.name, name: category.name, description: category.description })),
      products: fallbackProducts
    }, { headers: { 'cache-control': 'no-store' } });
  }

  try {
    const db = await getDb();
    const [categories, products] = await Promise.all([
      listCategories(db),
      listCatalogProducts(db)
    ]);
    return NextResponse.json({
      categories: categories.map((category) => ({
        id: category._id.toHexString(),
        name: category.name,
        description: category.description || ''
      })),
      products
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Catalog load failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      categories: fallbackCategories.map((category) => ({ id: category.name, name: category.name, description: category.description })),
      products: fallbackProducts
    }, { headers: { 'cache-control': 'no-store' } });
  }
}
