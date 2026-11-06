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

import { sourceCatalogCategories, sourceCatalogProducts } from '@/lib/source-catalog';

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

export function getProductPrice(product: Pick<Product, 'price' | 'storagePrices'>, storage?: string) {
  const optionPrice = storage ? product.storagePrices?.[storage] : undefined;
  return typeof optionPrice === 'number' && Number.isFinite(optionPrice) && optionPrice > 0
    ? optionPrice
    : product.price;
}

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}
