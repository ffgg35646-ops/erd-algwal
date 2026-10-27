import { notFound } from 'next/navigation';
import ProductDetails from '@/components/ProductDetails';
import { getProduct, products } from '@/lib/products';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return products.map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getProduct(id);
  return {
    title: product ? product.name + ' | أرض الجوال' : 'المنتج غير موجود | أرض الجوال'
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();
  return <ProductDetails product={product} />;
}
