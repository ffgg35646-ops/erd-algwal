'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { formatPrice, type Product } from '@/lib/products';
import StoreBannerSlider from '@/components/StoreBannerSlider';
import CustomerReviews from '@/components/CustomerReviews';

const categorySymbols: Record<string, string> = {
  'آيفون': '',
  'سامسونج': '◈',
  'سماعات': '♫',
  'شواحن': 'ϟ',
  'إكسسوارات': '✦'
};

function normalizeSearchValue(value: string | number) {
  return String(value)
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .trim();
}

function matchesSearch(product: Product, term: string) {
  if (!term) return true;
  const searchableValues = [
    product.name,
    product.category,
    product.shortDescription,
    product.description,
    product.price,
    product.oldPrice || '',
    product.id,
    ...(product.specifications || []),
    ...(product.colors || []),
    ...(product.storageOptions || [])
  ];
  return searchableValues.some((value) => normalizeSearchValue(value).includes(term));
}

export default function StoreHome() {
  const { catalogProducts: products, catalogCategories: categories } = useCart();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
    if (initialQuery) setSearch(initialQuery);
    const handleSearch = (event: Event) => {
      const queryEvent = event as CustomEvent<string>;
      setSearch(queryEvent.detail || '');
    };
    window.addEventListener('store-search', handleSearch);
    return () => window.removeEventListener('store-search', handleSearch);
  }, []);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const term = normalizeSearchValue(search);

  const searchedProducts = useMemo(
    () => products.filter((product) => matchesSearch(product, term)),
    [products, term]
  );

  const allCategories = useMemo(() => {
    const knownNames = new Set(categories.map((category) => category.name));
    const extraNames = Array.from(new Set(products.map((product) => product.category)))
      .filter((name) => name && !knownNames.has(name) && categories.length === 0);
    return [
      ...categories,
      ...extraNames.map((name) => ({ id: name, name, description: 'تصفح منتجات القسم' }))
    ];
  }, [categories, products]);

  useEffect(() => {
    if (selectedCategory && !allCategories.some((category) => category.name === selectedCategory)) setSelectedCategory('');
  }, [allCategories, selectedCategory]);

  const sections = useMemo(
    () => allCategories
      .map((category) => ({
        ...category,
        products: searchedProducts.filter((product) => product.category === category.name)
      }))
      .filter((category) => (!term || category.products.length > 0) && (!selectedCategory || selectedCategory === category.name)),
    [allCategories, searchedProducts, term, selectedCategory]
  );

  function toggleCategory(categoryName: string) {
    setExpandedCategory((current) => current === categoryName ? null : categoryName);
  }

  return (
    <main className="store-home" id="home">
      <StoreBannerSlider />
      <div className="category-stream" id="categories">
        {sections.length ? sections.map((category) => {
          const isExpanded = expandedCategory === category.name;
          const symbol = categorySymbols[category.name] || '✦';

          return (
            <section className="category-stream-section" id={'category-' + category.name} key={category.id || category.name} aria-label={'قسم ' + category.name}>
              <div className="category-stream-heading">
                <button
                  type="button"
                  className="category-heading-main"
                  onClick={() => category.products.length && toggleCategory(category.name)}
                  aria-expanded={isExpanded}
                  disabled={!category.products.length}
                >
                  <span className="category-stream-symbol" aria-hidden="true">{symbol}</span>
                  <span className="category-heading-copy">
                    <strong>{category.name}</strong>
                    <small>{category.products.length ? category.products.length + ' منتج' : 'لا توجد منتجات حاليًا'}</small>
                  </span>
                </button>
                {category.products.length > 4 ? (
                  <button
                    type="button"
                    className="category-more-button"
                    onClick={() => toggleCategory(category.name)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'عرض أقل' : 'المزيد'}
                    <span aria-hidden="true">{isExpanded ? '↑' : '←'}</span>
                  </button>
                ) : null}
              </div>

              {category.products.length ? (
                isExpanded ? (
                  <div className="category-expanded-grid" aria-label={'كل منتجات ' + category.name}>
                    {category.products.map((product) => (
                      <StripProductCard key={'expanded-' + product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="category-product-slider" aria-label={'منتجات ' + category.name}>
                    {category.products.slice(0, 4).map((product) => (
                      <StripProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )
              ) : (
                <div className="category-no-products">سيتم عرض المنتجات هنا عند إضافتها من لوحة الإدارة.</div>
              )}
            </section>
          );
        }) : (
          <div className="store-no-results">
            <span>⌕</span>
            <strong>ما لقيناش منتج مطابق للبحث</strong>
            <p>جرّب اسمًا أو لونًا أو سعرًا مختلفًا.</p>
            <button type="button" className="store-reset-search" onClick={() => { setSearch(''); setSelectedCategory(''); }}>عرض كل الأقسام</button>
          </div>
        )}
      </div>

      <CustomerReviews />
      <section className="store-documents" aria-label="التوثيقات والاعتمادات">
        <div className="store-documents-inner">
          <h2>التوثيقات والاعتمادات</h2>
          <div className="store-documents-list"><div className="store-document-placeholder">تُضاف وثائق واعتمادات المتجر هنا</div></div>
        </div>
      </section>
    </main>
  );
}

function StripProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart(product.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className="strip-product-card">
      <Link href={'/products/' + product.id} className="strip-product-image" aria-label={'تفاصيل ' + product.name}>
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.badge ? <span className="strip-product-badge">{product.badge}</span> : null}
      </Link>
      <div className="strip-product-info">
        <span className="strip-product-category">{product.category}</span>
        <Link href={'/products/' + product.id} className="strip-product-name">{product.name}</Link>
        <div className="strip-product-bottom">
          <div className="strip-price-group">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice ? <del>{formatPrice(product.oldPrice)}</del> : null}
          </div>
          <div className="strip-product-actions">
            <button
              type="button"
              className={'strip-add-button' + (added ? ' is-added' : '')}
              onClick={handleAdd}
              aria-label={'إضافة ' + product.name + ' إلى السلة'}
              title="أضف إلى السلة"
            >
              {added ? 'تمت الإضافة' : 'أضف إلى السلة'}
            </button>
            <Link href="/cart" className="strip-go-cart-button" aria-label="الانتقال إلى سلة المشتريات" title="عرض السلة">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
