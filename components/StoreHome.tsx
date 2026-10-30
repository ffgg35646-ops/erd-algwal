'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
                  <AutoProductSlider categoryName={category.name} products={category.products} />
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


function AutoProductSlider({ categoryName, products }: { categoryName: string; products: Product[] }) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const activeStartRef = useRef(0);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    let intervalId: number | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const getCards = () => Array.from(slider.querySelectorAll<HTMLElement>('.strip-product-card'));

    const getVisibleCount = (cards: HTMLElement[]) => {
      if (!cards.length) return 1;
      const computed = window.getComputedStyle(slider);
      const gap = Number.parseFloat(computed.columnGap || computed.gap || '0') || 0;
      const cardWidth = cards[0].getBoundingClientRect().width;
      if (!cardWidth) return 1;
      return Math.max(1, Math.floor((slider.clientWidth + gap) / (cardWidth + gap)));
    };

    const stopAutoplay = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      intervalId = undefined;
    };

    const syncActiveStart = () => {
      const cards = getCards();
      if (!cards.length) {
        activeStartRef.current = 0;
        return;
      }
      const containerRect = slider.getBoundingClientRect();
      const isRtl = window.getComputedStyle(slider).direction === 'rtl';
      const edge = isRtl ? containerRect.right : containerRect.left;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const cardEdge = isRtl ? rect.right : rect.left;
        const distance = Math.abs(cardEdge - edge);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      activeStartRef.current = closestIndex;
    };

    const startAutoplay = () => {
      stopAutoplay();
      const cards = getCards();
      const visibleCount = getVisibleCount(cards);
      if (cards.length <= visibleCount || slider.scrollWidth <= slider.clientWidth + 2) return;

      intervalId = window.setInterval(() => {
        const currentCards = getCards();
        const currentVisibleCount = getVisibleCount(currentCards);
        if (currentCards.length <= currentVisibleCount || slider.scrollWidth <= slider.clientWidth + 2) {
          stopAutoplay();
          activeStartRef.current = 0;
          return;
        }

        const lastStart = currentCards.length - currentVisibleCount;
        const currentStart = Math.min(activeStartRef.current, lastStart);
        const nextStart = currentStart >= lastStart
          ? 0
          : Math.min(currentStart + currentVisibleCount, lastStart);
        activeStartRef.current = nextStart;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        currentCards[nextStart]?.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'start'
        });
      }, 5000);
    };

    slider.addEventListener('scroll', syncActiveStart, { passive: true });
    window.addEventListener('resize', startAutoplay, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(startAutoplay);
      resizeObserver.observe(slider);
    }
    startAutoplay();

    return () => {
      stopAutoplay();
      resizeObserver?.disconnect();
      slider.removeEventListener('scroll', syncActiveStart);
      window.removeEventListener('resize', startAutoplay);
    };
  }, [categoryName, products]);

  return (
    <div ref={sliderRef} className="category-product-slider" aria-label={'منتجات ' + categoryName}>
      {products.map((product) => (
        <StripProductCard key={product.id} product={product} />
      ))}
    </div>
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
