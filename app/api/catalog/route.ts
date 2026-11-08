import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ensureDefaultProducts, listCatalogProducts, listCategories } from '@/lib/catalog';
import { categories as fallbackCategories, defaultStoreProducts, type Product } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CatalogCategoryItem = {
  id: string;
  name: string;
  description: string;
};

type CatalogCategoryResult = {
  items: CatalogCategoryItem[];
  source: 'database' | 'database-direct' | 'fallback';
};

const fallbackCategoryItems: CatalogCategoryItem[] = fallbackCategories.map((category) => ({
  id: category.name,
  name: category.name,
  description: category.description
}));

const NO_STORE_HEADERS = { 'cache-control': 'no-store, max-age=0' };
// Public catalogue data can be reused briefly at the browser/CDN layer. The
// client still keeps its last good snapshot and refreshes it in the background.
const CATALOG_CACHE_HEADERS = {
  'cache-control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=120'
};

async function readCategories(db: Awaited<ReturnType<typeof getDb>>): Promise<CatalogCategoryResult> {
  try {
    const categories = await listCategories(db);
    return {
      items: categories.map((category) => ({
        id: category._id.toHexString(),
        name: category.name,
        description: category.description || ''
      })),
      source: 'database'
    };
  } catch (error) {
    console.error(
      'Catalogue category initialization failed; trying the saved categories directly:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    try {
      // This read does not run the one-time seed reconciliation.
      const categories = await db.collection('categories')
        .find({ deleted: { $ne: true } })
        .sort({ createdAt: 1, name: 1 })
        .toArray();
      return {
        items: categories
          .filter((category) => typeof category.name === 'string' && category.name.trim())
          .map((category) => ({
            id: String(category._id),
            name: String(category.name),
            description: typeof category.description === 'string' ? category.description : ''
          })),
        source: 'database-direct'
      };
    } catch (directError) {
      console.error(
        'Direct category read failed:',
        directError instanceof Error ? directError.message : 'Unknown error'
      );
      return { items: fallbackCategoryItems, source: 'fallback' };
    }
  }
}

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({
      error: 'Catalogue database connection failed',
      categories: [],
      products: [],
      redCategoryBarIds: null,
      sources: { categories: 'unavailable', products: 'unavailable' }
    }, { status: 503, headers: NO_STORE_HEADERS });
  }

  try {
    const db = await getDb();

    // Keep one-time catalogue safety checks before serving records. After this,
    // independent reads run together instead of waiting on one another.
    await ensureDefaultProducts(db);

    const categoryPromise = readCategories(db);
    const productPromise = listCatalogProducts(db).then(
      (products) => ({ products, error: null as string | null }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Catalogue product load failed:', message);
        return { products: null, error: message };
      }
    );
    const redBarPromise = db.collection<{ _id: string; categoryIds?: string[] }>('store_settings')
      .findOne({ _id: 'red-category-bar' })
      .catch((error) => {
        console.error('Red category bar settings read failed:', error instanceof Error ? error.message : 'Unknown error');
        return null;
      });

    const [categoryResult, productResult, redBarSettings] = await Promise.all([
      categoryPromise,
      productPromise,
      redBarPromise
    ]);

    if (!productResult.products) {
      return NextResponse.json({
        error: 'Catalogue products could not be loaded',
        categories: categoryResult.items,
        products: [],
        redCategoryBarIds: Array.isArray(redBarSettings?.categoryIds) ? redBarSettings.categoryIds : null,
        sources: { categories: categoryResult.source, products: 'unavailable' }
      }, { status: 503, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json({
      categories: categoryResult.items,
      products: productResult.products as Product[],
      // null preserves the current default: show all active categories.
      redCategoryBarIds: Array.isArray(redBarSettings?.categoryIds)
        ? redBarSettings.categoryIds
        : null,
      sources: { categories: categoryResult.source, products: 'database' }
    }, { headers: CATALOG_CACHE_HEADERS });
  } catch (error) {
    console.error('Catalogue database connection failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      categories: fallbackCategoryItems,
      products: defaultStoreProducts,
      redCategoryBarIds: null,
      sources: { categories: 'fallback', products: 'fallback' }
    }, { headers: NO_STORE_HEADERS });
  }
}
