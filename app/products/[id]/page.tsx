import { notFound } from 'next/navigation';
import ProductDetails from '@/components/ProductDetails';
import { getProduct } from '@/lib/products';
import { getDb } from '@/lib/mongodb';
import { findStoredProduct, serializeStoredProduct } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

async function resolveProduct(id: string) {
  const builtIn = getProduct(id);
  if (builtIn) return builtIn;
  if (!process.env.MONGODB_URI) return null;
  try {
    const db = await getDb();
    const stored = await findStoredProduct(db, id);
    return stored ? serializeStoredProduct(stored) : null;
  } catch (error) {
    console.error('Product details load failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await resolveProduct(id);
  return {
    title: product ? product.name : 'المنتج غير موجود'
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await resolveProduct(id);
  if (!product) notFound();
  return <ProductDetails product={product} />;
}
