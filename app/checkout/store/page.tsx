'use client';

import Link from 'next/link';
import styles from '../checkout.module.css';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { parseCartItemKey, useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';
import { CUSTOMER_EMAIL_STORAGE_KEY, getCustomerNotificationKey } from '@/lib/customer-notifications-client';

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
  idNumber: string;
  regionId: string;
  cityId: string;
  city: string;
  addressDetails: string;
  installment: 'yes' | 'no';
  installmentDownPayment: string;
  installmentMonths: string;
  acceptedPolicies: boolean;
};

const EMPTY_FORM: CheckoutForm = {
  fullName: '',
  phone: '',
  email: '',
  idNumber: '',
  regionId: '',
  cityId: '',
  city: '',
  addressDetails: '',
  installment: 'no',
  installmentDownPayment: '',
  installmentMonths: '',
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

function normalizeSaudiPhoneDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function sanitizeSaudiPhoneInput(value: string) {
  return normalizeSaudiPhoneDigits(value).replace(/[^0-9]/g, '').slice(0, 10);
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
      const raw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
      const savedDraft = raw ? JSON.parse(raw) as Partial<CheckoutForm> & { neighborhood?: string; street?: string; building?: string; notes?: string } : {};
      const savedEmail = window.localStorage.getItem(CUSTOMER_EMAIL_STORAGE_KEY) || '';
      const restored: CheckoutForm = {
        ...EMPTY_FORM,
        fullName: typeof savedDraft.fullName === 'string' ? savedDraft.fullName : '',
        phone: typeof savedDraft.phone === 'string' ? sanitizeSaudiPhoneInput(savedDraft.phone) : '',
        email: savedEmail.trim() || (typeof savedDraft.email === 'string' ? savedDraft.email : ''),
        idNumber: typeof savedDraft.idNumber === 'string' ? normalizeSaudiPhoneDigits(savedDraft.idNumber).replace(/[^0-9]/g, '').slice(0, 10) : '',
        regionId: typeof savedDraft.regionId === 'string' ? savedDraft.regionId : '',
        cityId: typeof savedDraft.cityId === 'string' ? savedDraft.cityId : '',
        city: typeof savedDraft.city === 'string' ? savedDraft.city : '',
        addressDetails: typeof savedDraft.addressDetails === 'string'
          ? savedDraft.addressDetails
          : [savedDraft.neighborhood, savedDraft.street, savedDraft.building, savedDraft.notes].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join('، '),
        installment: savedDraft.installment === 'yes' ? 'yes' : 'no',
        installmentDownPayment: ['500', '750', '1000', '1500', '2000'].includes(String(savedDraft.installmentDownPayment ?? '')) ? String(savedDraft.installmentDownPayment) : '',
        installmentMonths: ['3', '6', '12', '24'].includes(String(savedDraft.installmentMonths ?? '')) ? String(savedDraft.installmentMonths) : '',
        acceptedPolicies: savedDraft.acceptedPolicies === true
      };
      setForm(restored);
      setCitySearch(restored.city);
      if (restored.email.trim()) window.localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, restored.email.trim());
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

  const cartLines = useMemo(() => Object.entries(cart).map(([cartKey, quantity]) => {
    const { productId, color } = parseCartItemKey(cartKey);
    return { cartKey, color, product: products.find((item) => item.id === productId), quantity };
  }).filter((line) => Boolean(line.product)), [cart]);

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
    if (!form.addressDetails.trim()) {
      setFormError('اكتب تفاصيل العنوان.');
      return;
    }
    if (form.installment === 'yes' && (
      !['500', '750', '1000', '1500', '2000'].includes(form.installmentDownPayment) ||
      !['3', '6', '12', '24'].includes(form.installmentMonths)
    )) {
      setFormError('اختر الدفعة المقدمة ومدة التقسيط.');
      return;
    }
    const cleanPhone = normalizeSaudiPhoneDigits(form.phone);
    if (!/^05[0-9]{8}$/.test(cleanPhone)) {
      setFormError('اكتب رقم جوال سعودي من 10 أرقام يبدأ بـ 05، مثل 05XXXXXXXX.');
      return;
    }
    const cleanIdNumber = normalizeSaudiPhoneDigits(form.idNumber).replace(/[^0-9]/g, '');
    if (!/^[0-9]{10}$/.test(cleanIdNumber)) {
      setFormError('اكتب رقم الهوية أو الإقامة المكوّن من 10 أرقام.');
      return;
    }
    if (!form.acceptedPolicies) {
      setFormError('يجب الموافقة على سياسة الضمان والاسترجاع والتوصيل قبل المتابعة.');
      return;
    }

    const items = cartLines.map(({ product, quantity, color }) => ({
      productId: product!.id,
      quantity,
      ...(color ? { color } : {})
    }));
    const payload = {
      fullName: form.fullName.trim(),
      phone: cleanPhone,
      email: form.email.trim(),
      idNumber: cleanIdNumber,
      region: regionLabel(selectedRegion.name_ar),
      city: form.city,
      addressDetails: form.addressDetails.trim(),
      installment: form.installment,
      installmentDownPayment: form.installment === 'yes' ? Number(form.installmentDownPayment) : null,
      installmentMonths: form.installment === 'yes' ? Number(form.installmentMonths) : null,
      acceptedPolicies: form.acceptedPolicies,
      items
    };
    const fingerprint = JSON.stringify(payload);

    try {
      setIsSubmitting(true);
      let submissionId = '';
      try {
        const previousRaw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
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
        items: cartLines.map(({ product, quantity, color }) => ({
          productId: product!.id,
          name: product!.name,
          unitPrice: product!.price,
          quantity,
          ...(color ? { color } : {})
        })),
        total,
        currency: 'SAR',
        submissionId,
        submissionFingerprint: fingerprint,
        savedAt: new Date().toISOString(),
        stage: 'delivery-details'
      };
      window.sessionStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify(checkoutDraft));

      let reviewToken = '';
      try {
        reviewToken = window.localStorage.getItem('erd-algwal-review-token') || '';
        if (!reviewToken) {
          reviewToken = window.crypto.randomUUID();
          window.localStorage.setItem('erd-algwal-review-token', reviewToken);
        }
      } catch {
        reviewToken = window.crypto.randomUUID();
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, submissionId, customerNotificationKey: getCustomerNotificationKey(), reviewToken })
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

      window.sessionStorage.setItem('erd-algwal-checkout-draft-v1', JSON.stringify({
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
    return <main className={`${styles.checkoutShell} container checkout-page`}><div className="cart-loading">جاري تحميل سلة المشتريات...</div></main>;
  }

  return (
    <main className={`${styles.checkoutShell} container checkout-page`}>
      <div className="breadcrumbs">
        <Link href="/">الرئيسية</Link><span>/</span><Link href="/cart">سلة المشتريات</Link><span>/</span><span>إنهاء الطلب</span>
      </div>

      <div className="checkout-topline checkout-topline-compact">
        <div className="checkout-step-indicator checkout-step-indicator-plain">
          <div><strong>الشحن والتوصيل</strong><small>الخطوة الأولى</small></div>
        </div>
      </div>

      {!cartLines.length ? (
        <section className="checkout-empty">
          <div className="empty-cart-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></svg></div>
          <h2>سلتك فاضية</h2>
          <p>أضف المنتجات اللي تحتاجها، وبعدها ارجع لإدخال بيانات التوصيل.</p>
          <Link href="/#categories" className="primary-button">تصفح المنتجات</Link>
        </section>
      ) : (
        <div className="checkout-layout">
          <form className="checkout-form-card" onSubmit={handleSubmit}>
            <section className="checkout-form-section">
              <div className="checkout-section-heading"><span className="checkout-section-number">١</span><div><h2>بيانات التواصل</h2></div></div>
              <div className="checkout-fields-grid">
                <label className="checkout-field checkout-field-full">
                  <span>الاسم بالكامل <b>*</b></span>
                  <input name="fullName" value={form.fullName} onChange={(event) => setField('fullName', event.target.value)} placeholder="اكتب الاسم بالكامل" autoComplete="name" required minLength={2} />
                </label>
                <label className="checkout-field">
                  <span>رقم الجوال <b>*</b></span>
                  <div className="saudi-phone-input" dir="ltr">
                    <span className="saudi-phone-flag" role="img" aria-label="السعودية">🇸🇦</span>
                    <input name="phone" type="tel" dir="ltr" value={form.phone} onChange={(event) => setField('phone', sanitizeSaudiPhoneInput(event.target.value))} placeholder="05XXXXXXXX" inputMode="numeric" autoComplete="tel-national" maxLength={10} minLength={10} required />
                  </div>
                </label>
                <label className="checkout-field">
                  <span>البريد الإلكتروني <b>*</b></span>
                  <input name="email" type="email" value={form.email} onChange={(event) => {
                    const value = event.target.value;
                    setField('email', value);
                    try { window.localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, value); } catch { /* Keep checkout usable without browser storage. */ }
                  }} placeholder="name@example.com" autoComplete="email" required />
                </label>
                <label className="checkout-field checkout-field-full">
                  <span>رقم الهوية <b>*</b></span>
                  <input name="idNumber" value={form.idNumber} onChange={(event) => setField('idNumber', normalizeSaudiPhoneDigits(event.target.value).replace(/[^0-9]/g, '').slice(0, 10))} placeholder="أدخل رقم الهوية المكوّن من 10 أرقام" inputMode="numeric" autoComplete="off" maxLength={10} minLength={10} pattern="[0-9]{10}" required />
                </label>
              </div>
            </section>

            <section className="checkout-form-section">
              <div className="checkout-section-heading"><span className="checkout-section-number">٢</span><div><h2>الشحن والتوصيل</h2></div></div>
              <div className="checkout-fields-grid">
                <label className="checkout-field">
                  <span>المنطقة <b>*</b></span>
                  <select name="regionId" value={form.regionId} onChange={(event) => handleRegionChange(event.target.value)} required disabled={regionsLoading}>
                    <option value="">{regionsLoading ? 'جاري تحميل المناطق...' : 'اختر المنطقة'}</option>
                    {regions.map((region) => <option key={region.region_id} value={String(region.region_id)}>{regionLabel(region.name_ar)}</option>)}
                  </select>
                </label>

                <div className="checkout-field city-combobox">
                  <label htmlFor="checkout-city"><span>المدينة <b>*</b></span></label>
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
                    placeholder={form.regionId ? (citiesLoading ? 'جاري تحميل المدن...' : 'اختر المدينة') : 'اختر المنطقة أولًا'}
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
                      {cityOptions.length === 80 ? <p className="city-options-hint">اكتب مزيدًا من حروف اسم المدينة لتضييق البحث.</p> : null}
                    </div>
                  ) : null}
                </div>

                <label className="checkout-field checkout-field-full">
                  <span>تفاصيل العنوان <b>*</b></span>
                  <textarea name="addressDetails" rows={2} value={form.addressDetails} onChange={(event) => setField('addressDetails', event.target.value)} placeholder="اكتب الحي والشارع ورقم المبنى وأي تفاصيل تساعد في الوصول إليك." required />
                </label>
              </div>
            </section>

            <section className="checkout-form-section checkout-extra-options">
              <div className="installment-heading-row">
                <span className="checkout-section-number">٣</span>
                <button
                  type="button"
                  className={form.installment === 'yes' ? 'installment-toggle active' : 'installment-toggle'}
                  aria-pressed={form.installment === 'yes'}
                  onClick={() => {
                    setForm((current) => ({
                      ...current,
                      installment: current.installment === 'yes' ? 'no' : 'yes',
                      installmentDownPayment: '',
                      installmentMonths: ''
                    }));
                    setFormError('');
                  }}
                >
                  <span>هل تريد تقسيط الجهاز؟</span>
                  <span className="installment-switch" aria-hidden="true"><span /></span>
                </button>
              </div>
              {form.installment === 'yes' ? (
                <div className="installment-details">
                  <p>اختر مدة التقسيط</p>
                  <div className="checkout-fields-grid">
                    <label className="checkout-field">
                      <span>الدفعة المقدمة <b>*</b></span>
                      <select name="installmentDownPayment" value={form.installmentDownPayment} onChange={(event) => setField('installmentDownPayment', event.target.value)} required>
                        <option value="">اختر الدفعة المقدمة</option>
                        <option value="500">500 ريال</option>
                        <option value="750">750 ريال</option>
                        <option value="1000">1000 ريال</option>
                        <option value="1500">1500 ريال</option>
                        <option value="2000">2000 ريال</option>
                      </select>
                    </label>
                    <label className="checkout-field">
                      <span>مدة التقسيط <b>*</b></span>
                      <select name="installmentMonths" value={form.installmentMonths} onChange={(event) => setField('installmentMonths', event.target.value)} required>
                        <option value="">اختر المدة</option>
                        <option value="3">3 شهور</option>
                        <option value="6">6 شهور</option>
                        <option value="12">12 شهر</option>
                        <option value="24">24 شهر</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}
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

          <aside className="checkout-order-summary checkout-order-summary-compact">
            <h2>ملخص طلبك</h2>
            <div className="checkout-order-items">
              {cartLines.map(({ cartKey, product, color, quantity }) => product ? (
                <div className="checkout-order-item" key={cartKey}>
                  <img src={product.image} alt={product.name} />
                  <div><strong>{product.name}</strong>{color ? <small>اللون: {color}</small> : null}<small>الكمية: {quantity}</small></div>
                  <b>{formatPrice(product.price * quantity)}</b>
                </div>
              ) : null)}
            </div>
            <div className="checkout-total-row"><span>عدد القطع</span><strong>{cartLines.reduce((sum, line) => sum + line.quantity, 0)}</strong></div>
            
            <div className="checkout-grand-total"><span>الإجمالي الحالي</span><strong>{formatPrice(total)}</strong></div>
          </aside>
        </div>
      )}
    </main>
  );
}
