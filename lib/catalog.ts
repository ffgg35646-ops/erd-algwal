import { ObjectId, type AnyBulkWriteOperation, type Collection, type Db, type Document, type Filter } from 'mongodb';
import { categories as seedCategories, defaultStoreProducts, type Product, type ProductColorMask } from '@/lib/products';

export type StoreCategory = Document & {
  _id: ObjectId;
  name: string;
  description?: string;
  icon?: string;
  seedName?: string;
  sortOrder?: number;
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
  imageUrlMediaId?: string;
  imageUrlDataBase64?: string;
  imageUrlContentType?: string;
  imagesDataBase64?: string[];
  imageContentTypes?: string[];
  imageMediaIds?: string[];
  colorImagesDataBase64?: Record<string, string>;
  colorImageContentTypes?: Record<string, string>;
  colorImageMediaIds?: Record<string, string>;
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
  sourceStore?: string;
  sourceProductUrl?: string;
  colorMask?: ProductColorMask;
  createdAt: Date;
  updatedAt: Date;
};

// Cache one-time catalogue initialization per configured database. The Vercel
// Mongo client returns a Db wrapper per request, so key by database + URI.
const categoryInitialization = new Map<string, Promise<void>>();
const productInitialization = new Map<string, Promise<void>>();
const externalCatalogDetection = new Map<string, Promise<boolean>>();
const blockedCatalogImageCleanup = new Map<string, Promise<void>>();

function initializationKey(db: Db) {
  return (process.env.MONGODB_URI || '') + ':' + db.databaseName;
}


/**
 * Detect catalog data that is not owned by this module's hard-coded seed list.
 * Imported/admin-managed records must never enter the legacy replacement path:
 * that path only understands seedId/seedName and would otherwise archive them.
 */
async function hasExternallyManagedCatalog(db: Db) {
  const key = initializationKey(db);
  let pending = externalCatalogDetection.get(key);

  if (!pending) {
    pending = (async () => {
      const categoryCollection = db.collection<StoreCategory>('categories');
      const productCollection = db.collection<StoredProduct>('products');
      const seedCategoryNames = seedCategories.map((category) => category.name);
      const seedProductIds = defaultStoreProducts.map((product) => product.id);

      const [externalCategory, externalProduct] = await Promise.all([
        categoryCollection.findOne({
          $or: [
            { sourceStore: { $exists: true } },
            { sourceCategorySlugs: { $exists: true } },
            { sourceCategoryUrls: { $exists: true } },
            { slug: { $exists: true } },
            { name: { $nin: seedCategoryNames } }
          ]
        }, { projection: { _id: 1 } }),
        productCollection.findOne({
          $or: [
            { sourceStore: { $exists: true } },
            { seedId: { $regex: /^qauraa:/i } },
            { sourceProductId: { $exists: true } },
            { sourceProductUrl: { $exists: true } },
            { sourceCategorySlug: { $exists: true } },
            // $nin also matches missing seedId; preserve active records without
            // a seed identity instead of treating them as obsolete demo products.
            { seedId: { $nin: seedProductIds }, deleted: { $ne: true } },
            {
              $and: [
                { seedId: { $nin: seedProductIds } },
                {
                  $or: [
                    { imageUrl: { $regex: '^https?://', $options: 'i' } },
                    { images: { $elemMatch: { $regex: '^https?://', $options: 'i' } } }
                  ]
                }
              ]
            }
          ]
        }, { projection: { _id: 1 } })
      ]);

      return Boolean(externalCategory || externalProduct);
    })();
    externalCatalogDetection.set(key, pending);
  }

  try {
    const detected = await pending;
    // Cache only a positive result: a catalog may be imported after a request
    // that found no external records, and that later import must be detected.
    if (!detected && externalCatalogDetection.get(key) === pending) {
      externalCatalogDetection.delete(key);
    }
    return detected;
  } catch (error) {
    if (externalCatalogDetection.get(key) === pending) externalCatalogDetection.delete(key);
    throw error;
  }
}

async function ensureCategoryNameIndex(collection: Collection<StoreCategory>) {
  const indexes = await collection.listIndexes().toArray();
  const hasNameIndex = indexes.some((index) => {
    const keys = Object.entries(index.key || {});
    return keys.length === 1 && keys[0][0] === 'name' && keys[0][1] === 1;
  });

  // An existing unique index on the same key also supports category-name lookups.
  if (!hasNameIndex) {
    await collection.createIndex({ name: 1 });
  }
}

async function initializeDefaultCategories(db: Db) {
  const collection = db.collection<StoreCategory>('categories');
  const productCollection = db.collection<StoredProduct>('products');
  const now = new Date();

  // Never run seed reconciliation when imported or admin-managed catalog
  // records exist. Their IDs and category metadata are not legacy seed IDs.
  if (await hasExternallyManagedCatalog(db)) {
    // Imported catalogue collections already exist and are admin-managed.
    // Their browse path needs no index creation or schema reconciliation.
    return;
  }

  const retainedIds: ObjectId[] = [];

  // Reconcile all old copies of each source category before exposing the
  // category list. Earlier imports could leave duplicate names/seed names,
  // which made a unique-index creation fail before the catalogue migration ran.
  for (const category of seedCategories) {
    const matches = await collection.find({
      $or: [
        { seedName: category.name },
        { name: category.name }
      ]
    }).sort({ createdAt: 1, _id: 1 }).toArray();

    let canonicalId: ObjectId;
    if (matches.length) {
      canonicalId = matches[0]._id;
      await collection.updateOne(
        { _id: canonicalId },
        {
          $set: {
            name: category.name,
            seedName: category.name,
            description: category.description,
            icon: category.icon,
            updatedAt: now
          },
          $unset: { deleted: '' }
        }
      );

      for (const duplicate of matches.slice(1)) {
        const duplicateId = duplicate._id.toHexString();
        await productCollection.updateMany(
          { categoryId: duplicateId },
          {
            $set: {
              categoryId: canonicalId.toHexString(),
              category: category.name,
              updatedAt: now
            }
          }
        );
        await collection.updateOne(
          { _id: duplicate._id },
          {
            $set: { deleted: true, updatedAt: now },
            $unset: { seedName: '' }
          }
        );
      }
    } else {
      const inserted = await collection.insertOne({
        name: category.name,
        seedName: category.name,
        description: category.description,
        icon: category.icon,
        createdAt: now,
        updatedAt: now
      } as StoreCategory);
      canonicalId = inserted.insertedId;
    }

    retainedIds.push(canonicalId);
  }

  // Archive only obsolete records that were explicitly tagged as legacy seeds.
  // Categories without seedName belong to an importer or the admin bot.
  await collection.updateMany(
    {
      _id: { $nin: retainedIds },
      seedName: { $type: 'string', $nin: seedCategories.map((category) => category.name) },
      deleted: { $ne: true }
    },
    { $set: { deleted: true, updatedAt: now } }
  );

  // Use non-unique lookup indexes only. Do not let historical duplicate
  // documents prevent future catalogue initialization.
  await ensureCategoryNameIndex(collection);
  await collection.createIndex({ seedName: 1 });
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

  // Imported and admin-managed catalog records may not use the old seedId
  // convention. Exit before duplicate repair, indexes, or archive migrations.
  if (await hasExternallyManagedCatalog(db)) return;

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
    // Never archive admin/imported products that do not carry a legacy seedId.
    await collection.updateMany(
      { seedId: { $type: 'string', $nin: productIds }, deleted: { $ne: true } },
      { $set: { deleted: true, updatedAt: now } }
    );
    await categoryCollection.updateMany(
      { seedName: { $type: 'string', $nin: categoryNames }, deleted: { $ne: true } },
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

type SortableCategory = {
  sortOrder?: unknown;
  displayOrder?: unknown;
  createdAt?: unknown;
  name?: unknown;
};

function getCategoryManualOrder(category: SortableCategory) {
  for (const value of [category.sortOrder, category.displayOrder]) {
    const order = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
    if (Number.isFinite(order)) return order;
  }
  return undefined;
}

/**
 * Match BB's category ordering: explicit admin order first, then the catalogue
 * source order, and only then createdAt/name for unknown legacy categories.
 * This keeps old categories without order metadata from jumping ahead of the
 * iPhone 18 source categories merely because they were created earlier.
 */
export function sortCategoriesByOrder<T>(categories: T[]): T[] {
  const sourceOrder = new Map<string, number>(seedCategories.map((category, index) => [category.name, index] as const));

  return [...categories].sort((left, right) => {
    const leftCategory = left as unknown as SortableCategory;
    const rightCategory = right as unknown as SortableCategory;
    const leftName = typeof leftCategory.name === 'string' ? leftCategory.name : '';
    const rightName = typeof rightCategory.name === 'string' ? rightCategory.name : '';

    const leftManual = getCategoryManualOrder(leftCategory);
    const rightManual = getCategoryManualOrder(rightCategory);

    if (leftManual !== undefined && rightManual !== undefined) {
      if (leftManual !== rightManual) return leftManual - rightManual;
    } else if (leftManual !== undefined) {
      return -1;
    } else if (rightManual !== undefined) {
      return 1;
    }

    const leftSourceOrder = sourceOrder.get(leftName);
    const rightSourceOrder = sourceOrder.get(rightName);
    if (leftSourceOrder !== undefined && rightSourceOrder !== undefined) {
      if (leftSourceOrder !== rightSourceOrder) return leftSourceOrder - rightSourceOrder;
    } else if (leftSourceOrder !== undefined) {
      return -1;
    } else if (rightSourceOrder !== undefined) {
      return 1;
    }

    const leftCreatedAt = leftCategory.createdAt instanceof Date ? leftCategory.createdAt.getTime() : 0;
    const rightCreatedAt = rightCategory.createdAt instanceof Date ? rightCategory.createdAt.getTime() : 0;
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

    return leftName.localeCompare(rightName, 'ar');
  });
}

export async function listCategories(db: Db) {
  await ensureDefaultCategories(db);
  const categories = await db.collection<StoreCategory>('categories')
    .find({ deleted: { $ne: true } })
    .toArray();
  return sortCategoriesByOrder(categories);
}

const REMOVED_CATALOG_IMAGE_NAME = 'GjaaIMG_fbc54b6d-bf6a-49e0-83c1-8c3551b1036c.png';
const BLOCKED_CATALOG_IMAGE_NAMES = new Set([
  'mtc3img_6a7a1945-3a12-4fac-82cc-e207d76bdee8.png',
  '1793472237161236.png',
  REMOVED_CATALOG_IMAGE_NAME
]);

function catalogImageFilename(value: string) {
  const path = value.trim().replace(/\\/g, '/').split(/[?#]/, 1)[0];
  const filename = path.slice(path.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(filename).toLowerCase();
  } catch {
    return filename.toLowerCase();
  }
}

/** Exclude known broken source images from absolute URLs and relative paths. */
export function isBlockedCatalogImage(value: unknown): boolean {
  return typeof value === 'string'
    && BLOCKED_CATALOG_IMAGE_NAMES.has(catalogImageFilename(value));
}

function isRemovedCatalogImage(value: unknown) {
  return typeof value === 'string'
    && catalogImageFilename(value) === REMOVED_CATALOG_IMAGE_NAME.toLowerCase();
}

/**
 * Permanently remove the requested source image from product records once per
 * database/runtime. This cleans the stored gallery, cover image, and variants,
 * rather than relying only on presentation-time filtering.
 */
async function removeRequestedCatalogImageReferences(db: Db) {
  const key = initializationKey(db);
  let pending = blockedCatalogImageCleanup.get(key);

  if (!pending) {
    pending = (async () => {
      const collection = db.collection<StoredProduct>('products');
      const products = await collection.find({}, {
        projection: { _id: 1, imageUrl: 1, images: 1, colorImages: 1 }
      }).toArray();

      for (const product of products) {
        const originalImages = Array.isArray(product.images) ? product.images : [];
        const filteredImages = originalImages.filter((image) => !isRemovedCatalogImage(image));
        const originalColorImages = Object.entries(product.colorImages || {});
        const filteredColorImages = Object.fromEntries(
          originalColorImages.filter(([, image]) => !isRemovedCatalogImage(image))
        );
        const removeGalleryImage = filteredImages.length !== originalImages.length;
        const removeCoverImage = isRemovedCatalogImage(product.imageUrl);
        const removeVariantImage = Object.keys(filteredColorImages).length !== originalColorImages.length;

        if (!removeGalleryImage && !removeCoverImage && !removeVariantImage) continue;

        const setFields: Partial<StoredProduct> = { updatedAt: new Date() };
        if (removeGalleryImage) setFields.images = filteredImages;
        if (removeVariantImage) setFields.colorImages = filteredColorImages;

        const update: {
          $set: Partial<StoredProduct>;
          $unset?: { imageUrl: '' };
        } = { $set: setFields };
        if (removeCoverImage) update.$unset = { imageUrl: '' };
        await collection.updateOne({ _id: product._id }, update);
      }
    })();
    blockedCatalogImageCleanup.set(key, pending);
  }

  try {
    await pending;
  } catch (error) {
    if (blockedCatalogImageCleanup.get(key) === pending) {
      blockedCatalogImageCleanup.delete(key);
    }
    throw error;
  }
}

function isHttpImageUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function getStoredProductStorage(
  product: Pick<StoredProduct, 'storageOptions' | 'storagePrices'>
) {
  // The imported product document already stores its exact available choices
  // and per-capacity prices. Never reduce them based on the capacity in its name.
  return {
    storageOptions: product.storageOptions || [],
    storagePrices: product.storagePrices || {}
  };
}

function getProductImageVersion(product: StoredProduct) {
  const versionSource = JSON.stringify({
    updatedAt: product.updatedAt instanceof Date
      ? product.updatedAt.getTime()
      : product.updatedAt || null,
    imageUrl: product.imageUrl || '',
    imageUrlMediaId: product.imageUrlMediaId || '',
    images: Array.isArray(product.images) ? product.images : [],
    imageMediaIds: product.imageMediaIds || [],
    imagesDataLengths: (product.imagesDataBase64 || []).map((value) => value?.length || 0),
    colorImages: product.colorImages || {},
    colorImageMediaIds: product.colorImageMediaIds || {},
    colorImageDataLengths: Object.fromEntries(
      Object.entries(product.colorImagesDataBase64 || {}).map(([color, value]) => [color, value?.length || 0])
    )
  });

  // Stable lightweight hash: Telegram file IDs/media IDs change even when an
  // older admin deployment forgets to update products.updatedAt.
  let hash = 2166136261;
  for (let index = 0; index < versionSource.length; index += 1) {
    hash ^= versionSource.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function serializeStoredProduct(product: StoredProduct, options: { includeColorMask?: boolean } = {}): Product & {
  categoryId: string;
  colors: string[];
  storageOptions: string[];
  storagePrices: Record<string, number>;
  images: string[];
} {
  const id = product._id.toHexString();
  const colorImageVersion = getProductImageVersion(product);
  const images = Array.isArray(product.images) ? product.images : [];
  // Keep indices stable across Telegram IDs, MongoDB media references, and
  // images written directly to MongoDB by an importer.
  const imageSlots = Math.max(
    images.length,
    product.imageMediaIds?.length || 0,
    product.imagesDataBase64?.length || 0
  );
  const storedImageUrls = Array.from({ length: imageSlots }, (_, index) => {
    const image = images[index];
    if (typeof image === 'string' && isBlockedCatalogImage(image)) return '';
    if (typeof image === 'string' && isHttpImageUrl(image)) return image;
    if (image || product.imageMediaIds?.[index] || product.imagesDataBase64?.[index]) {
      return `/api/products/${id}/image?index=${index}&v=${colorImageVersion}`;
    }
    return '';
  }).filter(Boolean);
  const fallbackImage = isBlockedCatalogImage(product.imageUrl)
    ? ''
    : product.imageUrl
      ? (isHttpImageUrl(product.imageUrl) || product.imageUrl.startsWith('/') || product.imageUrl.startsWith('data:image/')
        ? product.imageUrl
        : `/api/products/${id}/image?source=cover&v=${colorImageVersion}`)
      : product.imageUrlMediaId || product.imageUrlDataBase64
        ? `/api/products/${id}/image?source=cover&v=${colorImageVersion}`
        : '';
  const displayImages = storedImageUrls.length ? storedImageUrls : fallbackImage ? [fallbackImage] : [];
  const storage = getStoredProductStorage(product);
  const colorNames = new Set([
    ...Object.keys(product.colorImages || {}),
    ...Object.keys(product.colorImagesDataBase64 || {}),
    ...Object.keys(product.colorImageMediaIds || {})
  ]);
  const colorImages = Object.fromEntries(
    [...colorNames]
      .filter((color) => !isBlockedCatalogImage(product.colorImages?.[color]))
      .map((color) => {
        const image = product.colorImages?.[color];
        return [
          color,
          typeof image === 'string' && isHttpImageUrl(image)
            ? image
            : `/api/products/${id}/image?color=${encodeURIComponent(color)}&v=${colorImageVersion}`
        ] as const;
      })
  );
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
    ...(Object.keys(colorImages).length ? { colorImages } : {}),
    // Qauraa imports represent each source product URL as one sellable SKU.
    // Do not inherit capacities merged from similarly named sibling products.
    storageOptions: storage.storageOptions,
    storagePrices: storage.storagePrices,
    shortDescription: product.shortDescription || product.details,
    description: product.details,
    specifications: product.specifications || [],
    ...(options.includeColorMask && product.colorMask ? { colorMask: product.colorMask } : {})
  };
}

export async function listCatalogProducts(db: Db): Promise<Product[]> {
  await ensureDefaultProducts(db);
  await removeRequestedCatalogImageReferences(db);
  // The homepage catalogue never needs the large AI color mask payload.
  const saved = await db.collection<StoredProduct>('products')
    .find({ deleted: { $ne: true } }, { projection: { colorMask: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  // Keep every imported source product as its own catalogue entry.
  // Storage capacities from separate Qauraa product URLs must never be merged.
  return saved.map((product) => serializeStoredProduct(product));

}

export async function findStoredProduct(db: Db, id: string) {
  const collection = db.collection<StoredProduct>('products');
  return ObjectId.isValid(id)
    ? collection.findOne({ _id: new ObjectId(id), deleted: { $ne: true } })
    : collection.findOne({ seedId: id, deleted: { $ne: true } });
}
function normalizeCatalogProductName(value: string) {
  return value.normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function storedProductCompleteness(product: StoredProduct) {
  return (product.colors?.length || 0) * 20
    + (product.storageOptions?.length || 0) * 10
    + Object.keys(product.storagePrices || {}).length * 12
    + (product.images?.length || 0) * 4
    + Object.keys(product.colorImages || {}).length * 10
    + (product.details?.trim() ? 2 : 0);
}

/**
 * Older catalogue URLs encode one colour as a separate static product slug.
 * Resolve those URLs to the complete imported MongoDB product instead of
 * showing the stripped-down hard-coded fallback product.
 */
export async function findLegacyStoredProduct(
  db: Db,
  product: Pick<Product, 'name' | 'category' | 'specifications'>
) {
  const colourSpec = product.specifications?.find((item) => /^اللون\s*:/u.test(item));
  const variantColor = colourSpec?.replace(/^اللون\s*:\s*/u, '').trim() || '';
  let baseName = product.name.trim();

  if (variantColor) {
    const suffixes = [' - ' + variantColor, ' – ' + variantColor, ' — ' + variantColor];
    const suffix = suffixes.find((item) => baseName.endsWith(item));
    if (suffix) baseName = baseName.slice(0, -suffix.length).trim();
  }

  const normalizedName = normalizeCatalogProductName(baseName);
  if (!normalizedName) return null;

  const candidates = await db.collection<StoredProduct>('products')
    .find({ deleted: { $ne: true }, name: { $type: 'string' } })
    .toArray();

  let matches = candidates.filter(
    (candidate) => normalizeCatalogProductName(candidate.name) === normalizedName
  );

  // Use the matching category only when there is no exact name match.
  if (!matches.length && product.category) {
    const normalizedCategory = normalizeCatalogProductName(
      product.category.replace(/^سلسلة\s*/u, '')
    );
    matches = candidates.filter((candidate) =>
      normalizeCatalogProductName(candidate.category || '') === normalizedCategory
      && normalizeCatalogProductName(candidate.name).includes(normalizedName)
    );
  }

  if (!matches.length) return null;

  if (variantColor) {
    const normalizedColor = normalizeCatalogProductName(variantColor);
    const colorMatches = matches.filter((candidate) =>
      (candidate.colors || []).some(
        (color) => normalizeCatalogProductName(color) === normalizedColor
      )
      || Object.keys(candidate.colorImages || {}).some(
        (color) => normalizeCatalogProductName(color) === normalizedColor
      )
    );
    if (colorMatches.length) matches = colorMatches;
  }

  matches.sort((left, right) => {
    const completeness = storedProductCompleteness(right) - storedProductCompleteness(left);
    if (completeness) return completeness;

    const leftUpdated = left.updatedAt instanceof Date ? left.updatedAt.getTime() : 0;
    const rightUpdated = right.updatedAt instanceof Date ? right.updatedAt.getTime() : 0;
    return rightUpdated - leftUpdated;
  });

  return matches[0] || null;
}
