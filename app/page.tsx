import StoreHome, { type InitialStoreCatalog } from '@/components/StoreHome';
import { getDb } from '@/lib/mongodb';
import { ensureDefaultProducts, listCatalogProducts, listCategories } from '@/lib/catalog';
import type { StoreCategory } from '@/components/CartProvider';
import { listStoreBanners, type StoreBanner } from '@/lib/store-banners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadInitialCatalog(): Promise<InitialStoreCatalog | null> {
  if (!process.env.MONGODB_URI) return null;

  try {
    const db = await getDb();

    // Run the same catalogue safety initialization used by the catalogue API
    // before reading the database-backed products for the initial HTML.
    await ensureDefaultProducts(db);

    const categoriesPromise = (async (): Promise<StoreCategory[]> => {
      try {
        const categories = await listCategories(db);
        return categories.map((category) => ({
          id: category._id.toHexString(),
          name: category.name,
          description: category.description || '',
          ...(category.icon ? { icon: category.icon } : {})
        }));
      } catch (error) {
        console.error(
          'Homepage catalogue category read failed; trying direct database read:',
          error instanceof Error ? error.message : 'Unknown error'
        );

        try {
          const categories = await db.collection('categories')
            .find({ deleted: { $ne: true } })
            .sort({ createdAt: 1, name: 1 })
            .toArray();

          return categories
            .filter((category) => typeof category.name === 'string' && category.name.trim())
            .map((category) => ({
              id: String(category._id),
              name: String(category.name),
              description: typeof category.description === 'string' ? category.description : '',
              ...(typeof category.icon === 'string' && category.icon ? { icon: category.icon } : {})
            }));
        } catch (directError) {
          console.error(
            'Homepage direct category read failed:',
            directError instanceof Error ? directError.message : 'Unknown error'
          );
          return [];
        }
      }
    })();

    const [products, categories] = await Promise.all([
      listCatalogProducts(db),
      categoriesPromise
    ]);

    return { products, categories };
  } catch (error) {
    // The client-side catalogue request remains the fallback if the initial
    // server read is unavailable. Never substitute bundled or browser-cached products.
    console.error(
      'Homepage initial catalogue load failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

async function loadInitialBanners(): Promise<StoreBanner[] | null> {
  if (!process.env.MONGODB_URI) return null;

  try {
    const db = await getDb();
    return await listStoreBanners(db);
  } catch (error) {
    console.error(
      'Homepage initial slider load failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

export default async function HomePage() {
  const [initialCatalog, initialBanners] = await Promise.all([
    loadInitialCatalog(),
    loadInitialBanners()
  ]);
  return <StoreHome initialCatalog={initialCatalog} initialBanners={initialBanners} />;
}

