'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';

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
  installment: 'yes' | 'no';
  acceptedPolicies: boolean;
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
  notes: '',
  installment: 'no',
  acceptedPolicies: false
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
  const router = useRouter();
  const { cart, hydrated, catalogProducts: products } = useCart();
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    try {
      const raw = window.localStorage.getItem('erd-algwal-checkout-draft-v1');
      if (!raw) return;
      const savedDraft = JSON.parse(raw) as Partial<CheckoutForm>;
      const restored: CheckoutForm = {
        ...EMPTY_FORM,
        fullName: typeof savedDraft.fullName === 'string' ? savedDraft.fullName : '',
        phone: typeof savedDraft.phone === 'string' ? savedDraft.phone : '',
        email: typeof savedDraft.email === 'string' ? savedDraft.email : '',
        regionId: typeof savedDraft.regionId === 'string' ? savedDraft.regionId : '',
        cityId: typeof savedDraft.cityId === 'string' ? savedDraft.cityId : '',
        city: typeof savedDraft.city === 'string' ? savedDraft.city : '',
        neighborhood: typeof savedDraft.neighborhood === 'string' ? savedDraft.neighborhood : '',
        street: typeof savedDraft.street === 'string' ? savedDraft.street : '',
        building: typeof savedDraft.building === 'string' ? savedDraft.building : '',
        notes: typeof savedDraft.notes === 'string' ? savedDraft.notes : '',
        installment: savedDraft.installment === 'yes' ? 'yes' : 'no',
        acceptedPolicies: savedDraft.acceptedPolicies === true
      };
      setForm(restored);
      setCitySearch(restored.city);
    } catch {
      // A malformed local draft should never block checkout.
    }
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
    setFormError('');
  }

  function handleRegionChange(regionId: string) {
    setForm((current) => ({ ...current, regionId, cityId: '', city: '' }));
    setCitySearch('');
    setCityDropdownOpen(false);
    setFormError('');
  }

  function chooseCity(city: City) {
    setForm((current) => ({ ...current, cityId: String(city.city_id), city: city.name_ar }));
    setCitySearch(city.name_ar);
    setCityDropdownOpen(false);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
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
    const cleanPhone = form.phone.replace(/[\\s()-]/g, '');
    if (!/^(?:\\+?966|0)?5\\d{8}$/.test(cleanPhone)) {
      setFormError('اكتب رقم جوال سعودي صحيحًا، مثل 05XXXXXXXX أو +9665XXXXXXXX.');
      return;
    }
    if (!form.acceptedPolicies) {
      setFormError('يجب الموافقة على سياسة الضمان والاسترجاع والتوصيل قبل المتابعة.');
      return;
    }

    const items = cartLines.map(({ product, quantity }) => ({
      productId: product!.id,
      quantity
    }));
    const payload = {
      fullName: form.fullName.trim(),
      phone: cleanPhone,
      email: form.email.trim(),
      region: regionLabel(selectedRegion.name_ar),
      city: form.city,
      neighborhood: form.neighborhood.trim(),
      street: form.street.trim(),
      building: form.building.trim(),
      notes: form.notes.trim(),
      installment: form.installment,
      acceptedPolicies: form.acceptedPolicies,
      items
    };
    const fingerprint = JSON.stringify(payload);

    try {
      setIsSubmitting(true);
      let submissionId = '';
      try {
        const previousRaw = window.localStorage.getItem('erd-algwal-checkout-draft-v1');
        if (previousRaw) {
          const previous = JSON.parse(previousRaw) as { submissionId?: string; submissionFingerprint?: string; orderId?: string };
          if (previous.submissionFingerprint === fingerprint && typeof previous.submissionId === 'string' && !previous.orderId) {
            submissionId = previous.submissionId;
          }
        }
      } catch {
        // A malformed local draft is replaced below.
      }
      if (!submissionId) submissionId = window.crypto.randomUUID();

      const checkoutDraft = {
        ...form,
        ...payload,
        regionId: form.regionId,
        cityId: form.cityId,
        regionName: selectedRegion.name_ar,
        items: cartLines.map(({ product, quantity }) => ({
          productId: product!.id,
          name: product!.name,
          unitPrice: product!.price,
          quantity
        })),
        total,
        currency: 'SAR',
        submissionId,
        submissionFingerprint: fingerprint,
        savedAt: new Date().toISOString(),
        stage: 'delivery-details'
      };
      window.localStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify(checkoutDraft));

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, submissionId })
      });
      const result = await response.json() as {
        ok?: boolean;
        orderId?: string;
        orderNumber?: string;
        notificationSent?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !result.ok || !result.orderId || !result.orderNumber) {
        throw new Error(result.error || 'تعذر حفظ الطلب. حاول مرة أخرى.');
      }

      window.localStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify({
        ...checkoutDraft,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        notificationSent: result.notificationSent === true,
        savedAt: new Date().toISOString(),
        stage: 'payment'
      }));
      router.push('/checkout/payment');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر حفظ الطلب. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hydrated) {
    return <main className="container checkout-page"><div className="cart-loading">جاري تحميل سلة المشتريات...</div></main>;
  }

  return (
    <main className="container checkout-page">
      <div className="breadcrumbs">
        <Link href="/">الرئيسية</Link><span>/</span><Link href="/cart">سلة المشتريات</Link><span>/</span><span>إنهاء الطلب</span>
      </div>

      <div className="checkout-topline">
        <div>
          <span className="section-kicker">الخطوة الأولى من إتمام الطلب</span>
          <h1>عنوان التوصيل</h1>
          <p>اكتب بيانات التواصل وعنوان الاستلام عشان تكون جاهزة مع طلبك.</p>
        </div>
        <div className="checkout-step-indicator"><span>١</span><div><strong>الشحن والتوصيل</strong><small>الخطوة الأولى من ٢</small></div></div>
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
              <div className="checkout-section-heading"><span className="checkout-section-number">٢</span><div><h2>الشحن والتوصيل (1)</h2><p>عنوان التوصيل — اختر المنطقة ثم المدينة.</p></div></div>
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

            <section className="checkout-form-section checkout-extra-options">
              <div className="checkout-section-heading"><span className="checkout-section-number">٣</span><div><h2>هل تريد تقسيط الجهاز؟</h2><p>اختيارك يُحفظ مع بيانات الطلب؛ خيارات التقسيط الفعلية تحتاج تفعيل مزود التقسيط.</p></div></div>
              <div className="installment-choice">
                <label className={form.installment === 'no' ? 'installment-option selected' : 'installment-option'}>
                  <input type="radio" name="installment" value="no" checked={form.installment === 'no'} onChange={() => setField('installment', 'no')} />
                  <span><strong>لا، بدون تقسيط</strong><small>شراء عادي</small></span>
                </label>
                <label className={form.installment === 'yes' ? 'installment-option selected' : 'installment-option'}>
                  <input type="radio" name="installment" value="yes" checked={form.installment === 'yes'} onChange={() => setField('installment', 'yes')} />
                  <span><strong>نعم، أرغب في التقسيط</strong><small>تأكيد التوفر عند ربط مزود التقسيط</small></span>
                </label>
              </div>
              <label className="policy-consent">
                <input type="checkbox" checked={form.acceptedPolicies} onChange={(event) => setField('acceptedPolicies', event.target.checked)} required />
                <span>أقر أنني راغب في استلام الطلب وموافق على <Link href="/policies">سياسة الضمان والاسترجاع والتوصيل</Link>.</span>
              </label>
            </section>

            {formError ? <div className="checkout-alert checkout-alert-error" role="alert"><span>!</span>{formError}</div> : null}
            <div className="checkout-form-actions">
              <Link href="/cart" className="outline-button">العودة للسلة</Link>
              <button type="submit" className="primary-button checkout-submit" disabled={isSubmitting}>{isSubmitting ? 'جارٍ حفظ الطلب...' : 'إكمال الطلب'} <span aria-hidden="true">←</span></button>
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
            <p className="checkout-shipping-note">تكلفة الشحن تُحدد لاحقًا، والدفع في الخطوة التالية.</p>
            <div className="checkout-grand-total"><span>الإجمالي الحالي</span><strong>{formatPrice(total)}</strong></div>
            <Link href="/cart" className="checkout-edit-cart">تعديل محتويات السلة ←</Link>
          </aside>
        </div>
      )}
    </main>
  );
}
