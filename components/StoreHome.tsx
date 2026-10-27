'use client';

import { useMemo, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { useCart } from '@/components/CartProvider';

const categorySymbols: Record<string, string> = {
  'آيفون': '',
  'سامسونج': '◈',
  'سماعات': '♫',
  'شواحن': 'ϟ',
  'إكسسوارات': '✦'
};

export default function StoreHome() {
  const { catalogProducts: products, catalogCategories: categories } = useCart();
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [search, setSearch] = useState('');

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ar');
    return products.filter((product) => {
      const categoryMatches = activeCategory === 'الكل' || product.category === activeCategory;
      const searchMatches = !term || [product.name, product.category, product.shortDescription].some((value) => value.toLocaleLowerCase('ar').includes(term));
      return categoryMatches && searchMatches;
    });
  }, [activeCategory, search]);

  return (
    <main>
      <section className="hero-section">
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> عالم الجوالات في مكان واحد</span>
            <h1>التقنية اللي تحبها،<br /><span>أقرب لك.</span></h1>
            <p>اكتشف جوالاتك المفضلة وملحقاتها، واختر اللي يناسبك بكل سهولة.</p>
            <a href="#products" className="primary-button hero-button">تسوق المنتجات <span aria-hidden="true">←</span></a>
            <div className="hero-trust">
              <span><b>✓</b> خيارات متنوعة</span>
              <span><b>✓</b> تجربة تسوق سهلة</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-phone phone-back">
              <div className="camera-dot" /><div className="camera-dot" /><div className="camera-dot" />
            </div>
            <div className="hero-phone phone-front">
              <div className="phone-screen-glow" />
              <span className="phone-screen-brand">EG</span>
            </div>
            <div className="floating-chip chip-top"><span>✦</span> جودة تستحقها</div>
            <div className="floating-chip chip-bottom"><span>ϟ</span> اختيارات ذكية</div>
          </div>
        </div>
        <div className="hero-bottom-line" />
      </section>

      <section className="container benefits-strip" aria-label="مميزات المتجر">
        <div className="benefit-item"><span className="benefit-icon">✦</span><div><strong>منتجات مختارة</strong><small>خيارات تناسب احتياجك</small></div></div>
        <div className="benefit-item"><span className="benefit-icon">♡</span><div><strong>تجربة بسيطة</strong><small>تصفح وأضف للسلة بسهولة</small></div></div>
        <div className="benefit-item"><span className="benefit-icon">↻</span><div><strong>سلتك محفوظة</strong><small>ارجع في أي وقت من نفس المتصفح</small></div></div>
      </section>

      <section className="container section-block" id="categories">
        <div className="section-heading">
          <div><span className="section-kicker">تسوق حسب احتياجك</span><h2>تصفح الأقسام</h2></div>
          <span className="section-side-note">اختر القسم وابدأ الاستكشاف</span>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <button type="button" className={'category-tile' + (activeCategory === category.name ? ' active' : '')} key={category.name} onClick={() => { setActiveCategory(category.name); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <span className="category-symbol">{categorySymbols[category.name] || category.icon || '✦'}</span>
              <span className="category-title">{category.name}</span>
              <span className="category-description">{category.description}</span>
              <span className="category-arrow" aria-hidden="true">←</span>
            </button>
          ))}
        </div>
      </section>

      <section className="container section-block products-section" id="products">
        <div className="section-heading products-heading">
          <div><span className="section-kicker">اختيارات أرض الجوال</span><h2>منتجات تستحق التجربة</h2></div>
          <label className="search-box">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن جوال أو إكسسوار..." aria-label="ابحث عن المنتجات" />
          </label>
        </div>
        <div className="filter-row" aria-label="تصفية المنتجات">
          {['الكل', ...categories.map((category) => category.name)].map((category) => (
            <button type="button" className={'filter-pill' + (activeCategory === category ? ' active' : '')} key={category} onClick={() => setActiveCategory(category)}>{category}</button>
          ))}
        </div>
        {filteredProducts.length ? (
          <div className="product-grid">
            {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="empty-search"><span>⌕</span><h3>ما لقينا منتجات مطابقة</h3><p>جرّب كلمة بحث مختلفة أو اختر قسمًا آخر.</p><button type="button" className="outline-button" onClick={() => { setSearch(''); setActiveCategory('الكل'); }}>عرض كل المنتجات</button></div>
        )}
      </section>

      <section className="container service-banner">
        <div className="service-banner-mark">أ</div>
        <div><span>أرض الجوال</span><h2>اختيارك يبدأ من هنا</h2><p>تصفح المنتجات وأضف اختياراتك إلى السلة، وستبقى محفوظة في نفس المتصفح.</p></div>
        <a href="#products" className="service-banner-link">اكتشف المنتجات <span aria-hidden="true">←</span></a>
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <LinkBrand />
          <span>© {new Date().getFullYear()} أرض الجوال — جميع الحقوق محفوظة</span>
          <a href="#categories">تصفح الأقسام ↑</a>
        </div>
      </footer>
    </main>
  );
}

function LinkBrand() {
  return (
    <div className="footer-brand">
      <span className="brand-mark">أ</span>
      <strong>أرض الجوال</strong>
    </div>
  );
}
