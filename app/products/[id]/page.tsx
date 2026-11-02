import ProductDetailsLoader from '@/components/ProductDetailsLoader';
import { getProduct } from '@/lib/products';

export const dynamic = 'force-dynamic';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getProduct(id);
  return {
    title: product ? product.name : 'تفاصيل المنتج',
    description: product?.shortDescription || 'تفاصيل المنتج في أرض الجوال'
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  return <ProductDetailsLoader id={id} initialProduct={getProduct(id) || null} />;
}
