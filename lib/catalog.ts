import { ObjectId, type Db, type Document } from 'mongodb';
import { categories as seedCategories, products as seedProducts, type Product } from '@/lib/products';

export type StoreCategory = Document & {
  _id: ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
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
  price: number;
  details: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
};

export async function ensureDefaultCategories(db: Db) {
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

// Link the existing visible demo catalogue to the same MongoDB records the bot edits.
// Upsert only missing seed identities: never overwrite an existing admin edit.
export async function ensureDefaultProducts(db: Db) {
  await ensureDefaultCategories(db);
  const sections = await db.collection<StoreCategory>('categories').find({ seedName: { $exists: true } }).toArray();
  const bySeedName = new Map(sections.map(section => [String(section.seedName), section]));
  const collection = db.collection<StoredProduct>('products');
  await collection.createIndex({ seedId: 1 }, { unique: true, sparse: true });
  for (const product of seedProducts) {
    const section = bySeedName.get(product.category);
    if (!section) continue;
    const now = new Date();
    await collection.updateOne(
      { seedId: product.id },
      { $setOnInsert: {
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
        ...(product.oldPrice !== undefined ? { oldPrice: product.oldPrice } : {}),
        ...(product.badge ? { badge: product.badge } : {}),
        shortDescription: product.shortDescription,
        specifications: product.specifications,
        createdAt: now,
        updatedAt: now
      } },
      { upsert: true }
    );
  }
}

export async function listCategories(db: Db) {
  await ensureDefaultCategories(db);
  return db.collection<StoreCategory>('categories').find({}).sort({ createdAt: 1, name: 1 }).toArray();
}

export function serializeStoredProduct(product: StoredProduct): Product & {
  categoryId: string;
  colors: string[];
  storageOptions: string[];
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
