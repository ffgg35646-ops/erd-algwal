import { ObjectId, type AnyBulkWriteOperation, type Db, type Document, type Filter } from 'mongodb';
import { categories as seedCategories, defaultStoreProducts, type Product, type ProductColorMask } from '@/lib/products';

export type StoreCategory = Document & {
  _id: ObjectId;
  name: string;
  description?: string;
  icon?: string;
  seedName?: string;
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
  colorImages?: Record<string, string>;
  storageOptions: string[];
  storagePrices?: Record<string, number>;
  price: number;
  details: string;
  images: string[];
  colorMask?: ProductColorMask;
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
        { $set: { seedName: category.name, icon: category.icon } }
      );
      continue;
    }
    await collection.updateOne(
      { seedName: category.name },
      { $setOnInsert: { name: category.name, seedName: category.name, description: category.description, icon: category.icon, createdAt: new Date(), updatedAt: new Date() } },
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

// Replace the previous demo catalogue with the supplied source catalogue.
// Old catalogue records are soft-deleted so historical orders remain intact.
const SOURCE_CATALOG_MIGRATION_ID = 'source-catalog-replacement-qauara-v3';

async function initializeDefaultProducts(db: Db) {
  await ensureDefaultCategories(db);

  const collection = db.collection<StoredProduct>('products');
  const categoryCollection = db.collection<StoreCategory>('categories');
  const settings = db.collection<{
    _id: string;
    startedAt?: Date;
    archivedAt?: Date;
    completedAt?: Date;
    productIds?: string[];
    categories?: string[];
  }>('store_settings');

  const now = new Date();

  // Repair duplicate seed identities left by earlier catalogue imports before
  // creating the unique index. Keep the newest record as the canonical one;
  // retain duplicate documents as archived records without their seed identity.
  const duplicateSeedGroups = await collection.aggregate<{
    _id: string;
    documentIds: ObjectId[];
  }>([
    { $match: { seedId: { $type: 'string', $ne: '' } } },
    { $sort: { updatedAt: -1, createdAt: 1, _id: 1 } },
    { $group: { _id: '$seedId', documentIds: { $push: '$_id' } } },
    { $match: { 'documentIds.1': { $exists: true } } }
  ]).toArray();

  for (const group of duplicateSeedGroups) {
    const duplicateIds = group.documentIds.slice(1);
    if (!duplicateIds.length) continue;
    await collection.updateMany(
      { _id: { $in: duplicateIds } },
      {
        $set: { deleted: true, updatedAt: now },
        $unset: { seedId: '' }
      }
    );
  }

  await collection.createIndex({ seedId: 1 }, { unique: true, sparse: true });
  const productIds = defaultStoreProducts.map((product) => product.id);
  const categoryNames = seedCategories.map((category) => category.name);

  let migration = await settings.findOne({ _id: SOURCE_CATALOG_MIGRATION_ID });
  if (!migration) {
    await settings.updateOne(
      { _id: SOURCE_CATALOG_MIGRATION_ID },
      { $setOnInsert: { startedAt: now } },
      { upsert: true }
    );
    migration = await settings.findOne({ _id: SOURCE_CATALOG_MIGRATION_ID });
  }

  // Run the clean replacement only once for this catalogue version. Unlike the
  // previous migration, this also archives demo/custom entries left active by
  // the earlier one-time seed, while retaining every document for order history.
  if (!migration?.archivedAt) {
    await collection.updateMany(
      { seedId: { $nin: productIds }, deleted: { $ne: true } },
      { $set: { deleted: true, updatedAt: now } }
    );
    await categoryCollection.updateMany(
      { seedName: { $nin: categoryNames }, deleted: { $ne: true } },
      { $set: { deleted: true, updatedAt: now } }
    );

    // Restore and refresh only the categories explicitly supplied by this source.
    for (const category of seedCategories) {
      await categoryCollection.updateOne(
        { seedName: category.name },
        {
          $set: {
            name: category.name,
            description: category.description,
            icon: category.icon,
            updatedAt: now
          },
          $unset: { deleted: '' }
        }
      );
    }

    await settings.updateOne(
      { _id: SOURCE_CATALOG_MIGRATION_ID },
      { $set: { archivedAt: new Date() } },
      { upsert: true }
    );
    migration = await settings.findOne({ _id: SOURCE_CATALOG_MIGRATION_ID });
  }

  const shouldReplaceSourceRecords = !migration?.completedAt;
  const sections = await categoryCollection
    .find({ seedName: { $exists: true }, deleted: { $ne: true } })
    .toArray();
  const bySeedName = new Map(sections.map((section) => [String(section.seedName), section]));

  const operations: AnyBulkWriteOperation<StoredProduct>[] = [];

  for (const product of defaultStoreProducts) {
    const section = bySeedName.get(product.category);
    if (!section) continue;

    const sourceFields: Partial<StoredProduct> = {
      seedId: product.id,
      categoryId: section._id.toHexString(),
      category: section.name,
      name: product.name,
      colors: product.colors || [],
      storageOptions: product.storageOptions || [],
      price: product.price,
      details: product.description,
      images: [],
      imageUrl: product.image,
      shortDescription: product.shortDescription,
      specifications: product.specifications
    };

    if (shouldReplaceSourceRecords) {
      const setFields: Partial<StoredProduct> = {
        ...sourceFields,
        ...(product.oldPrice !== undefined ? { oldPrice: product.oldPrice } : {}),
        ...(product.badge ? { badge: product.badge } : {}),
        ...(product.storagePrices ? { storagePrices: product.storagePrices } : {}),
        deleted: false,
        updatedAt: now
      };
      const unsetFields: Partial<Record<
        'colorImages' | 'colorMask' | 'oldPrice' | 'badge' | 'storagePrices',
        ''
      >> = {
        colorImages: '',
        colorMask: ''
      };
      if (product.oldPrice === undefined) unsetFields.oldPrice = '';
      if (!product.badge) unsetFields.badge = '';
      if (!product.storagePrices) unsetFields.storagePrices = '';

      operations.push({
        updateOne: {
          filter: { seedId: product.id },
          update: {
            $set: setFields,
            $setOnInsert: { createdAt: now },
            $unset: unsetFields
          },
          upsert: true
        }
      });
      continue;
    }

    // After replacement, preserve admin edits/deletions and add only genuinely
    // new source entries that do not already have a seed identity.
    operations.push({
      updateOne: {
        filter: { seedId: product.id },
        update: {
          $setOnInsert: {
            ...sourceFields,
            ...(product.oldPrice !== undefined ? { oldPrice: product.oldPrice } : {}),
            ...(product.badge ? { badge: product.badge } : {}),
            ...(product.storagePrices ? { storagePrices: product.storagePrices } : {}),
            createdAt: now,
            updatedAt: now
          }
        },
        upsert: true
      }
    });
  }

  if (operations.length) {
    await collection.bulkWrite(operations, { ordered: false });
  }

  // Mark the replacement complete only after all target records are present.
  if (shouldReplaceSourceRecords) {
    await settings.updateOne(
      { _id: SOURCE_CATALOG_MIGRATION_ID },
      {
        $set: {
          completedAt: new Date(),
          productIds,
          categories: categoryNames
        }
      },
      { upsert: true }
    );
  }

  // One-time migration: populate missing/empty color options on already-seeded
  // products. Preserve any colors explicitly managed by the Telegram admin bot.
  const colorsMigration = await settings.findOne({ _id: 'default-product-colors-v1' });
  if (!colorsMigration) {
    const colorUpdates = defaultStoreProducts.flatMap((product) => {
      const colors = (product.colors || []).filter((color) => typeof color === 'string' && color.trim());
      if (!colors.length) return [];
      return [{
        updateOne: {
          filter: {
            seedId: product.id,
            $or: [
              { colors: { $exists: false } },
              { colors: null },
              { colors: { $size: 0 } }
            ]
          } as Filter<StoredProduct>,
          update: { $set: { colors, updatedAt: now } }
        }
      }];
    });
    if (colorUpdates.length) await collection.bulkWrite(colorUpdates, { ordered: false });
    await settings.updateOne(
      { _id: 'default-product-colors-v1' },
      { $setOnInsert: { completedAt: now, productIds: defaultStoreProducts.map((product) => product.id) } },
      { upsert: true }
    );
  }

  // Keep the removed demo phone out of the live catalogue without deleting order history.
  await collection.updateMany(
    { seedId: 'iphone-18-pro-max-256' },
    { $set: { deleted: true, updatedAt: now } }
  );
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

export function serializeStoredProduct(product: StoredProduct, options: { includeColorMask?: boolean } = {}): Product & {
  categoryId: string;
  colors: string[];
  storageOptions: string[];
  storagePrices: Record<string, number>;
  images: string[];
} {
  const id = product._id.toHexString();
  const colorImageVersion = product.updatedAt instanceof Date ? product.updatedAt.getTime() : 0;
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
    ...(Object.keys(product.colorImages || {}).length
      ? {
          colorImages: Object.fromEntries(
            Object.keys(product.colorImages || {}).map((color) => [
              color,
              `/api/products/${id}/image?color=${encodeURIComponent(color)}&v=${colorImageVersion}`
            ])
          )
        }
      : {}),
    storageOptions: product.storageOptions || [],
    storagePrices: product.storagePrices || {},
    shortDescription: product.shortDescription || product.details,
    description: product.details,
    specifications: product.specifications || [],
    ...(options.includeColorMask && product.colorMask ? { colorMask: product.colorMask } : {})
  };
}

export async function listCatalogProducts(db: Db): Promise<Product[]> {
  await ensureDefaultProducts(db);
  const saved = await db.collection<StoredProduct>('products').find({ deleted: { $ne: true } }).sort({ createdAt: -1 }).toArray();
  return saved.map((product) => serializeStoredProduct(product));
}

export async function findStoredProduct(db: Db, id: string) {
  const collection = db.collection<StoredProduct>('products');
  return ObjectId.isValid(id)
    ? collection.findOne({ _id: new ObjectId(id), deleted: { $ne: true } })
    : collection.findOne({ seedId: id, deleted: { $ne: true } });
}
