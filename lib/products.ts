import { sourceCatalogCategories, sourceCatalogProducts } from '@/lib/source-catalog';

export type ProductColorMask = {
  version: 1;
  sourceColor: string;
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Base64-encoded, MSB-first bit-packed mask: 1 = case, 0 = outside. */
  encoding: 'bit-packed-msb';
  data: string;
  model: 'sam-3.1' | 'manual-brush-v1';
  generatedAt: string | Date;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  image: string;
  shortDescription: string;
  description: string;
  specifications: string[];
  categoryId?: string;
  colors?: string[];
  /** Per-color product image URLs returned by the catalogue API. */
  colorImages?: Record<string, string>;
  storageOptions?: string[];
  storagePrices?: Record<string, number>;
  images?: string[];
  colorMask?: ProductColorMask;
};

export const categories = sourceCatalogCategories;
export const products: Product[] = sourceCatalogProducts;
export const defaultStoreProducts: Product[] = products;

export function formatPrice(value: number) {
  const amount = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(value);
  return amount + ' ر.س';
}

export function normalizeStorageOption(value: string) {
  return value.normalize('NFKC')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/جيجابايت|جيجا/g, '')
    .replace(/تيرابايت|تيرا/g, 'T')
    .replace(/GIGABYTES?|GB$/g, '')
    .replace(/TERABYTES?|TB$/g, 'T');
}

export function getStoragePrice(
  product: Pick<Product, 'storagePrices'>,
  storage?: string
) {
  if (!storage) return undefined;

  const exact = product.storagePrices?.[storage];
  if (typeof exact === 'number' && Number.isFinite(exact) && exact > 0) return exact;

  const normalized = normalizeStorageOption(storage);
  const match = Object.entries(product.storagePrices || {}).find(
    ([key, value]) => normalizeStorageOption(key) === normalized
      && typeof value === 'number'
      && Number.isFinite(value)
      && value > 0
  );

  return match?.[1];
}

export function getProductPrice(product: Pick<Product, 'price' | 'storagePrices'>, storage?: string) {
  return getStoragePrice(product, storage) ?? product.price;
}

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}
