'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useCart } from '@/components/CartProvider';
import { formatPrice, products } from '@/lib/products';

type Region = {
  region_id: number;
  code: string;
  name_ar: string;
  name_en: string;
  capital_city_id?: number;
};

type City = {
  city_id: number;
  region_id: number;
  name_ar: string;
  name_en: string;
};

type CheckoutForm = {
  fullName: string;
  phone: string;
  email: string;
  regionId: string;
  cityId: string;
  city: string;
  neighborhood: string;
  street: string;
  building: string;
  notes: string;
};

const EMPTY_FORM: CheckoutForm = {
  fullName: '',
  phone: '',
  email: '',
  regionId: '',
  cityId: '',
  city: '',
  neighborhood: '',
  street: '',
  building: '',
  notes: ''
};

function regionLabel(name: string) {
  return name.replace(/^منطقة\s+/, '');
}

function normalizeArabic(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
    .toLocaleLowerCase('ar');
}

export default function StoreCheckoutPage() {
  const { cart, hydrated } = useCart();
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/data/saudi-regions.json')
      .then((response) => {
        if (!response.ok) throw new Error('تعذر تحميل قائمة المناطق');
        return response.json() as Promise<Region[]>;
      })
      .then((data) => { if (alive) setRegions(data); })
      .catch(() => { if (alive) setFormError('تعذر تحميل قائمة مناطق السعودية. حدّث الصفحة وحاول مرة أخرى.'); })
      .finally(() => { if (alive) setRegionsLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!form.regionId || cities.length > 0) return;
    let alive = true;
    setCitiesLoading(true);
    fetch('/data/saudi-cities.json')
      .then((response) => {
        if (!response.ok) throw new Error('تعذر تحميل المدن');
        return response.json() as Promise<City[]>;
      })
      .then((data) => { if (alive) setCities(data); })
      .catch(() => { if (alive) setFormError('تعذر تحميل قائمة المدن. حدّث الصفحة وحاول مرة أخرى.'); })
      .finally(() => { if (alive) setCitiesLoading(false); });
    return () => { alive = false; };
  }, [form.regionId, cities.length]);

  const cartLines = useMemo(() => Object.entries(cart).map(([id, quantity]) => ({
    product: products.find((item) => item.id === id),
    quantity
  })).filter((line) => Boolean(line.product)), [cart]);

  const total = cartLines.reduce((sum, line) => sum + (line.product?.price || 0) * line.quantity, 0);
  const selectedRegion = regions.find((region) => String(region.region_id) === form.regionId);
  const cityOptions = useMemo(() => {
    if (!form.regionId) return [];
    const term = normalizeArabic(citySearch);
    return cities
      .filter((city) => city.region_id === Number(form.regionId))
      .filter((city) => !term || normalizeArabic(city.name_ar).includes(term) || normalizeArabic(city.name_en).includes(term))
      .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'))
      .slice(0, 80);
  }, [cities, form.regionId, citySearch]);

  function setField<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setFormError('');
  }

  function handleRegionChange(regionId: string) {
    setForm((current) => ({ ...current, regionId, cityId: '', city: '' }));
    setCitySearch('');
    setCityDropdownOpen(false);
    setSaved(false);
    setFormError('');
  }

  function chooseCity(city: City) {
    setForm((current) => ({ ...current, cityId: String(city.city_id), city: city.name_ar }));
    setCitySearch(city.name_ar);
    setCityDropdownOpen(false);
    setSaved(false);
    setFormError('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    if (!cartLines.length) {
      setFormError('سلة المشتريات فارغة. أضف المنتجات أولًا ثم ارجع لإتمام البيانات.');
      return;
    }
    if (!form.regionId || !selectedRegion) {
      setFormError('اختر المنطقة / المحافظة.');
      return;
    }
    if (!form.cityId || !form.city) {
      setFormError('اختر المدينة من القائمة، وليس بكتابة الاسم فقط.');
      return;
    }
    const cleanPhone = form.phone.replace(/[\s()-]/g, '');
    if (!/^(?:\+?966|0)?5\d{8}$/.test(cleanPhone)) {
      setFormError('اكتب رقم جوال سعودي صحيحًا، مثل 05XXXXXXXX أو +9665XXXXXXXX.');
      return;
    }

    const checkoutDraft = {
      ...form,
      phone: cleanPhone,
      region: selectedRegion.name_ar,
      city: form.city,
      items: cartLines.map(({ product, quantity }) => ({
        productId: product!.id,
        name: product!.name,
        unitPrice: product!.price,
        quantity
      })),
      total,
      currency: 'SAR',
      savedAt: new Date().toISOString(),
      stage: 'delivery-details'
    };

    try {
      window.localStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify(checkoutDraft));
      setSaved(true);
    } catch {
      setFormError('تعذر حفظ البيانات في المتصفح. تأكد أن التخزين المحلي غير محظور ثم حاول مرة أخرى.');
    }
  }

  if (!hydrated) {
    return <main className="container checkout-page"><div className="cart-loading">جاري تحميل سلة المشتريات...</div></main>;
  }

  return (
    <main className="container checkout-page">
      <div className="breadcrumbs">
        <Link href="/">الرئيسية</Link><span>/</span><Link href="/cart">سلة المشتريات</Link><span>/</span><span>بيانات التوصيل</span>
      </div>

      <div className="checkout-topline">
        <div>
          <span className="section-kicker">خطوة إتمام الطلب</span>
          <h1>بيانات التوصيل</h1>
          <p>اكتب بيانات التواصل وعنوان الاستلام عشان تكون جاهزة مع طلبك.</p>
        </div>
        <div className="checkout-step-indicator"><span>١</span><div><strong>بيانات العميل والعنوان</strong><small>بدون إنشاء حساب</small></div></div>
      </div>

      {!cartLines.length ? (
        <section className="checkout-empty">
          <div className="empty-cart-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg></div>
          <h2>سلتك فاضية</h2>
          <p>أضف المنتجات اللي تحتاجها، وبعدها ارجع لإدخال بيانات التوصيل.</p>
          <Link href="/#products" className="primary-button">تصفح المنتجات</Link>
        </section>
      ) : (
        <div className="checkout-layout">
          <form className="checkout-form-card" onSubmit={handleSubmit}>
            <section className="checkout-form-section">
              <div className="checkout-section-heading"><span className="checkout-section-number">١</span><div><h2>بيانات التواصل</h2><p>لن تحتاج إلى تسجيل الدخول أو إنشاء حساب.</p></div></div>
              <div className="checkout-fields-grid">
                <label className="checkout-field checkout-field-full">
                  <span>الاسم الكامل <b>*</b></span>
                  <input name="fullName" value={form.fullName} onChange={(event) => setField('fullName', event.target.value)} placeholder="اكتب الاسم الكامل" autoComplete="name" required minLength={2} />
                </label>
                <label className="checkout-field">
                  <span>رقم الجوال <b>*</b></span>
                  <input name="phone" value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="05XXXXXXXX" inputMode="tel" autoComplete="tel" required />
                  <small>رقم سعودي يبدأ عادةً بـ 05.</small>
                </label>
                <label className="checkout-field">
                  <span>البريد الإلكتروني <small>(اختياري)</small></span>
                  <input name="email" type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} placeholder="name@example.com" autoComplete="email" />
                </label>
              </div>
            </section>

            <section className="checkout-form-section">
              <div className="checkout-section-heading"><span className="checkout-section-number">٢</span><div><h2>عنوان الاستلام</h2><p>اختر المنطقة أولًا ثم حدد المدينة أو المحافظة من القائمة.</p></div></div>
              <div className="checkout-fields-grid">
                <label className="checkout-field">
                  <span>المنطقة / المحافظة <b>*</b></span>
                  <select name="regionId" value={form.regionId} onChange={(event) => handleRegionChange(event.target.value)} required disabled={regionsLoading}>
                    <option value="">{regionsLoading ? 'جاري تحميل المناطق...' : 'اختر المنطقة'}</option>
                    {regions.map((region) => <option key={region.region_id} value={String(region.region_id)}>{regionLabel(region.name_ar)}</option>)}
                  </select>
                  <small>تشمل المناطق الإدارية الثلاث عشرة في السعودية.</small>
                </label>

                <div className="checkout-field city-combobox">
                  <label htmlFor="checkout-city"><span>المدينة / المحافظة <b>*</b></span></label>
                  <input
                    id="checkout-city"
                    name="city"
                    value={citySearch}
                    onChange={(event) => {
                      setCitySearch(event.target.value);
                      setField('cityId', '');
                      setField('city', '');
                      setCityDropdownOpen(true);
                    }}
                    onFocus={() => setCityDropdownOpen(true)}
                    onBlur={() => window.setTimeout(() => setCityDropdownOpen(false), 120)}
                    placeholder={form.regionId ? (citiesLoading ? 'جاري تحميل المدن...' : 'ابحث عن مدينتك...') : 'اختر المنطقة أولًا'}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={cityDropdownOpen}
                    aria-controls="checkout-city-options"
                    disabled={!form.regionId || citiesLoading}
                    required
                  />
                  {cityDropdownOpen && form.regionId && !citiesLoading ? (
                    <div className="city-options" id="checkout-city-options" role="listbox">
                      {cityOptions.length ? cityOptions.map((city) => (
                        <button type="button" role="option" aria-selected={form.cityId === String(city.city_id)} key={city.city_id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseCity(city)}>
                          <span>{city.name_ar}</span><small>{city.name_en}</small>
                        </button>
                      )) : <p className="city-options-empty">لا توجد نتيجة مطابقة. جرّب اسمًا آخر.</p>}
                      {cityOptions.length === 80 ? <p className="city-options-hint">تظهر أول 80 نتيجة؛ اكتب مزيدًا من حروف اسم المدينة لتضييق البحث.</p> : null}
                    </div>
                  ) : null}
                  <small>{form.regionId ? 'اكتب جزءًا من اسم المدينة للبحث ضمن المنطقة المختارة.' : 'ستظهر المدن بعد تحديد المنطقة.'}</small>
                </div>

                <label className="checkout-field">
                  <span>الحي <b>*</b></span>
                  <input name="neighborhood" value={form.neighborhood} onChange={(event) => setField('neighborhood', event.target.value)} placeholder="اسم الحي" autoComplete="address-level3" required />
                </label>
                <label className="checkout-field">
                  <span>الشارع / تفاصيل العنوان <b>*</b></span>
                  <input name="street" value={form.street} onChange={(event) => setField('street', event.target.value)} placeholder="اسم الشارع وتفاصيل الموقع" autoComplete="street-address" required />
                </label>
                <label className="checkout-field">
                  <span>رقم المبنى أو الشقة <small>(اختياري)</small></span>
                  <input name="building" value={form.building} onChange={(event) => setField('building', event.target.value)} placeholder="رقم المبنى أو الشقة" />
                </label>
                <label className="checkout-field checkout-field-full">
                  <span>علامة مميزة أو ملاحظات للمندوب <small>(اختياري)</small></span>
                  <textarea name="notes" rows={3} value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="اكتب أي تفاصيل تساعد في الوصول إليك." />
                </label>
              </div>
            </section>

            {formError ? <div className="checkout-alert checkout-alert-error" role="alert"><span>!</span>{formError}</div> : null}
            {saved ? (
              <div className="checkout-alert checkout-alert-success" role="status">
                <span>✓</span>
                <div><strong>تم حفظ بيانات العنوان في هذا المتصفح.</strong><p>لم يتم إرسال طلب شراء بعد؛ ربط التأكيد مع MongoDB وبوت تيليجرام سيتم في المرحلة التالية.</p></div>
              </div>
            ) : null}

            <div className="checkout-form-actions">
              <Link href="/cart" className="outline-button">الرجوع للسلة</Link>
              <button type="submit" className="primary-button checkout-submit">{saved ? 'تحديث البيانات المحفوظة' : 'حفظ بيانات التوصيل'} <span aria-hidden="true">←</span></button>
            </div>
          </form>

          <aside className="checkout-order-summary">
            <h2>ملخص طلبك</h2>
            <div className="checkout-order-items">
              {cartLines.map(({ product, quantity }) => product ? (
                <div className="checkout-order-item" key={product.id}>
                  <img src={product.image} alt={product.name} />
                  <div><strong>{product.name}</strong><small>الكمية: {quantity}</small></div>
                  <b>{formatPrice(product.price * quantity)}</b>
                </div>
              ) : null)}
            </div>
            <div className="checkout-total-row"><span>عدد القطع</span><strong>{cartLines.reduce((sum, line) => sum + line.quantity, 0)}</strong></div>
            <div className="checkout-total-row"><span>قيمة المنتجات</span><strong>{formatPrice(total)}</strong></div>
            <p className="checkout-shipping-note">تكلفة الشحن وطريقة الدفع لم يتم تحديدهما في هذه المرحلة.</p>
            <div className="checkout-grand-total"><span>الإجمالي الحالي</span><strong>{formatPrice(total)}</strong></div>
            <Link href="/cart" className="checkout-edit-cart">تعديل محتويات السلة ←</Link>
          </aside>
        </div>
      )}
    </main>
  );
}
