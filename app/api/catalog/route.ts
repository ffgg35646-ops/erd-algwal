import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ensureDefaultProducts, listCatalogProducts, listCategories } from '@/lib/catalog';
import { categories as fallbackCategories, defaultStoreProducts } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CatalogCategoryItem = {
  id: string;
  name: string;
  description: string;
};

const fallbackCategoryItems: CatalogCategoryItem[] = fallbackCategories.map((category) => ({
  id: category.name,
  name: category.name,
  description: category.description
}));

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({
      categories: fallbackCategoryItems,
      products: defaultStoreProducts,
      sources: { categories: 'fallback', products: 'fallback' }
    }, { headers: { 'cache-control': 'no-store, max-age=0' } });
  }

  try {
    const db = await getDb();
    // Run the one-time catalogue replacement before reading categories so the
    // first storefront response never mixes archived and replacement sections.
    await ensureDefaultProducts(db);
    let categoryItems: CatalogCategoryItem[] = fallbackCategoryItems;
    let categorySource: 'database' | 'database-direct' | 'fallback' = 'fallback';

    // Keep category loading independent from product loading. A product catalogue
    // error must never replace the admin-managed sections with built-in defaults.
    try {
      const categories = await listCategories(db);
      categoryItems = categories.map((category) => ({
        id: category._id.toHexString(),
        name: category.name,
        description: category.description || ''
      }));
      categorySource = 'database';
    } catch (error) {
      console.error('Catalogue category initialization failed; trying the saved categories directly:', error instanceof Error ? error.message : 'Unknown error');

      // Reading existing category documents does not require the seed/index
      // initialization performed by listCategories().
      try {
        const categories = await db.collection('categories')
          .find({ deleted: { $ne: true } })
          .sort({ createdAt: 1, name: 1 })
          .toArray();
        categoryItems = categories
          .filter((category) => typeof category.name === 'string' && category.name.trim())
          .map((category) => ({
            id: String(category._id),
            name: String(category.name),
            description: typeof category.description === 'string' ? category.description : ''
          }));
        categorySource = 'database-direct';
      } catch (directError) {
        console.error('Direct category read failed:', directError instanceof Error ? directError.message : 'Unknown error');
      }
    }

    let productItems = defaultStoreProducts;
    let productSource: 'database' | 'fallback' = 'fallback';
    try {
      productItems = await listCatalogProducts(db);
      productSource = 'database';
    } catch (error) {
      console.error('Catalogue product load failed; keeping saved categories visible:', error instanceof Error ? error.message : 'Unknown error');
    }

    return NextResponse.json({
      categories: categoryItems,
      products: productItems,
      sources: { categories: categorySource, products: productSource }
    }, { headers: { 'cache-control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Catalogue database connection failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      categories: fallbackCategoryItems,
      products: defaultStoreProducts,
      sources: { categories: 'fallback', products: 'fallback' }
    }, { headers: { 'cache-control': 'no-store, max-age=0' } });
  }
}
