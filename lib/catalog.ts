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
  for (const category of seedCategories) {
    await collection.updateOne(
      { name: category.name },
      { $setOnInsert: { name: category.name, description: category.description, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  await collection.createIndex({ name: 1 }, { unique: true });
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
    specifications: [
      ...(product.colors?.length ? [`الألوان: ${product.colors.join('، ')}`] : []),
      ...(product.storageOptions?.length ? [`مساحات التخزين: ${product.storageOptions.join('، ')}`] : []),
      `القسم: ${product.category}`
    ]
  };
}

export async function listCatalogProducts(db: Db): Promise<Product[]> {
  const saved = await db.collection<StoredProduct>('products').find({}).sort({ createdAt: -1 }).toArray();
  const dynamicProducts = saved.map((product) => serializeStoredProduct(product));
  return [...dynamicProducts, ...seedProducts];
}

export async function findStoredProduct(db: Db, id: string) {
  if (!ObjectId.isValid(id)) return null;
  return db.collection<StoredProduct>('products').findOne({ _id: new ObjectId(id) });
}
