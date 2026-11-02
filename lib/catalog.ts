import { ObjectId, type Db, type Document } from 'mongodb';
import { categories as seedCategories, defaultStoreProducts, products as seedProducts, type Product } from '@/lib/products';

export type StoreCategory = Document & {
  _id: ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
};

export type StoredProduct = Document & {
  _id: ObjectId;
  categoryId: string;
  seedId?: string;
  deleted?: boolean;
  imageUrl?: string;
  oldPrice?: number;
  badge?: string;
  shortDescription?: string;
  specifications?: string[];
  category: string;
  name: string;
  colors: string[];
  storageOptions: string[];
  storagePrices?: Record<string, number>;
  price: number;
  details: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
};

// Cache one-time catalogue initialization per configured database. The Vercel
// Mongo client returns a Db wrapper per request, so key by database + URI.
const categoryInitialization = new Map<string, Promise<void>>();
const productInitialization = new Map<string, Promise<void>>();

function initializationKey(db: Db) {
  return (process.env.MONGODB_URI || '') + ':' + db.databaseName;
}

async function initializeDefaultCategories(db: Db) {
  const collection = db.collection<StoreCategory>('categories');
  await collection.createIndex({ name: 1 }, { unique: true });
  await collection.createIndex({ seedName: 1 }, { unique: true, sparse: true });
  for (const category of seedCategories) {
    const seeded = await collection.findOne({ seedName: category.name });
    if (seeded) continue;
    const existingLegacy = await collection.findOne({ name: category.name });
    if (existingLegacy) {
      await collection.updateOne(
        { _id: existingLegacy._id },
        { $set: { seedName: category.name } }
      );
      continue;
    }
    await collection.updateOne(
      { seedName: category.name },
      { $setOnInsert: { name: category.name, seedName: category.name, description: category.description, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  await collection.createIndex({ createdAt: -1 });
}

export async function ensureDefaultCategories(db: Db) {
  const key = initializationKey(db);
  let pending = categoryInitialization.get(key);
  if (!pending) {
    pending = initializeDefaultCategories(db);
    categoryInitialization.set(key, pending);
  }
  try {
    await pending;
  } catch (error) {
    if (categoryInitialization.get(key) === pending) categoryInitialization.delete(key);
    throw error;
  }
}

// Link the existing visible demo catalogue to the same MongoDB records the bot edits.
// Upsert only missing seed identities: never overwrite an existing admin edit.
const DEFAULT_PRODUCTS_MIGRATION_ID = 'default-products-10-v1';

async function initializeDefaultProducts(db: Db) {
  await ensureDefaultCategories(db);

  const collection = db.collection<StoredProduct>('products');
  const categoryCollection = db.collection<StoreCategory>('categories');
  const settings = db.collection('store_settings');
  await collection.createIndex({ seedId: 1 }, { unique: true, sparse: true });

  const migration = await settings.findOne({ _id: DEFAULT_PRODUCTS_MIGRATION_ID });
  if (!migration) {
    // Ensure the category needed by the initial ten products is active once.
    const defaultCategoryNames = [...new Set(defaultStoreProducts.map((product) => product.category))];
    for (const categoryName of defaultCategoryNames) {
      const seededCategory = await categoryCollection.findOne({ seedName: categoryName });
      if (seededCategory) {
        if (seededCategory.deleted) {
          await categoryCollection.updateOne(
            { _id: seededCategory._id },
            { $unset: { deleted: '' }, $set: { updatedAt: new Date() } }
          );
        }
        continue;
      }

      const legacyCategory = await categoryCollection.findOne({ name: categoryName });
      if (legacyCategory) {
        await categoryCollection.updateOne(
          { _id: legacyCategory._id },
          { $set: { seedName: categoryName, updatedAt: new Date() }, $unset: { deleted: '' } }
        );
      } else {
        await categoryCollection.updateOne(
          { seedName: categoryName },
          { $setOnInsert: { name: categoryName, seedName: categoryName, description: 'أجهزة آيفون', createdAt: new Date(), updatedAt: new Date() } },
          { upsert: true }
        );
      }
    }
  }

  const sections = await categoryCollection
    .find({ seedName: { $exists: true }, deleted: { $ne: true } })
    .toArray();
  const bySeedName = new Map(sections.map((section) => [String(section.seedName), section]));
  const now = new Date();
  const operations = defaultStoreProducts.flatMap((product) => {
    const section = bySeedName.get(product.category);
    if (!section) return [];
    return [{
      updateOne: {
        filter: { seedId: product.id },
        update: {
          $setOnInsert: {
            seedId: product.id,
            categoryId: section._id.toHexString(),
            category: section.name,
            name: product.name,
            colors: product.colors || [],
            storageOptions: product.storageOptions || [],
            ...(product.storagePrices ? { storagePrices: product.storagePrices } : {}),
            price: product.price,
            details: product.description,
            images: [],
            imageUrl: product.image,
            ...(product.oldPrice !== undefined ? { oldPrice: product.oldPrice } : {}),
            ...(product.badge ? { badge: product.badge } : {}),
            shortDescription: product.shortDescription,
            specifications: product.specifications,
            createdAt: now,
            updatedAt: now
          }
        },
        upsert: true
      }
    }];
  });
  if (operations.length) await collection.bulkWrite(operations, { ordered: false });

  if (!migration) {
    const defaultIds = defaultStoreProducts.map((product) => product.id);
    const legacySeedIds = seedProducts
      .filter((product) => !defaultIds.includes(product.id))
      .map((product) => product.id);

    // Hide the six older demo entries so the initial catalogue contains ten.
    if (legacySeedIds.length) {
      await collection.updateMany(
        { seedId: { $in: legacySeedIds } },
        { $set: { deleted: true, updatedAt: now } }
      );
    }

    // Restore the ten initial products once during this migration. Later
    // Telegram deletions stay deleted after the migration marker is saved.
    await collection.updateMany(
      { seedId: { $in: defaultIds }, deleted: true },
      { $unset: { deleted: '' }, $set: { updatedAt: now } }
    );
    await settings.updateOne(
      { _id: DEFAULT_PRODUCTS_MIGRATION_ID },
      { $setOnInsert: { completedAt: now, productIds: defaultIds } },
      { upsert: true }
    );
  }
}

export async function ensureDefaultProducts(db: Db) {
  const key = initializationKey(db);
  let pending = productInitialization.get(key);
  if (!pending) {
    pending = initializeDefaultProducts(db);
    productInitialization.set(key, pending);
  }
  try {
    await pending;
  } catch (error) {
    if (productInitialization.get(key) === pending) productInitialization.delete(key);
    throw error;
  }
}

export async function listCategories(db: Db) {
  await ensureDefaultCategories(db);
  return db.collection<StoreCategory>('categories').find({ deleted: { $ne: true } }).sort({ createdAt: 1, name: 1 }).toArray();
}

export function serializeStoredProduct(product: StoredProduct): Product & {
  categoryId: string;
  colors: string[];
  storageOptions: string[];
  storagePrices: Record<string, number>;
  images: string[];
} {
  const id = product._id.toHexString();
  const images = Array.isArray(product.images) ? product.images : [];
  const storedImageUrls = images.map((_, index) => `/api/products/${id}/image?index=${index}`);
  const displayImages = storedImageUrls.length ? storedImageUrls : product.imageUrl ? [product.imageUrl] : [];
  return {
    id: product.seedId || id,
    name: product.name,
    category: product.category,
    categoryId: product.categoryId,
    price: product.price,
    image: displayImages[0] || '',
    images: displayImages,
    ...(product.oldPrice !== undefined ? { oldPrice: product.oldPrice } : {}),
    ...(product.badge ? { badge: product.badge } : {}),
    colors: product.colors || [],
    storageOptions: product.storageOptions || [],
    storagePrices: product.storagePrices || {},
    shortDescription: product.shortDescription || product.details,
    description: product.details,
    specifications: product.specifications || []
  };
}

export async function listCatalogProducts(db: Db): Promise<Product[]> {
  await ensureDefaultProducts(db);
  const saved = await db.collection<StoredProduct>('products').find({ deleted: { $ne: true } }).sort({ createdAt: -1 }).toArray();
  return saved.map(serializeStoredProduct);
}

export async function findStoredProduct(db: Db, id: string) {
  const collection = db.collection<StoredProduct>('products');
  return ObjectId.isValid(id)
    ? collection.findOne({ _id: new ObjectId(id), deleted: { $ne: true } })
    : collection.findOne({ seedId: id, deleted: { $ne: true } });
}
