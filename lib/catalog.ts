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
  return {
    id,
    name: product.name,
    category: product.category,
    categoryId: product.categoryId,
    price: product.price,
    image: images.length ? `/api/products/${id}/image?index=0` : '',
    images: images.map((_, index) => `/api/products/${id}/image?index=${index}`),
    colors: product.colors || [],
    storageOptions: product.storageOptions || [],
    shortDescription: product.details,
    description: product.details,
    specifications: []
  };
}

export async function listCatalogProducts(db: Db): Promise<Product[]> {
  const [saved, seededSections] = await Promise.all([
    db.collection<StoredProduct>('products').find({}).sort({ createdAt: -1 }).toArray(),
    db.collection<StoreCategory>('categories').find({ seedName: { $exists: true } }).toArray()
  ]);
  const sectionNames = new Map(seededSections.map((section) => [String(section.seedName), section.name]));
  const dynamicProducts = saved.map((product) => serializeStoredProduct(product));
  const demoProducts = seedProducts.map((product) => ({
    ...product,
    category: sectionNames.get(product.category) || product.category
  }));
  return [...dynamicProducts, ...demoProducts];
}

export async function findStoredProduct(db: Db, id: string) {
  if (!ObjectId.isValid(id)) return null;
  return db.collection<StoredProduct>('products').findOne({ _id: new ObjectId(id) });
}
