'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styles from './account.module.css';
import { getCustomerNotificationKey } from '@/lib/customer-notifications-client';

type SavedOrderItem = {
  name?: string;
  quantity?: number;
  unitPrice?: number;
  color?: string;
};

type CheckoutDraft = {
  fullName?: string;
  phone?: string;
  email?: string;
  region?: string;
  regionName?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  building?: string;
  orderId?: string;
  orderNumber?: string;
  total?: number;
  currency?: string;
  items?: SavedOrderItem[];
  savedAt?: string;
  stage?: string;
};

type CustomerNotification = {
  orderNumber: string;
  status: string;
  statusLabel: string;
  cancellationReason: string;
  createdAt: string;
};

type StoreSettings = {
  whatsappNumber?: string;
  barcodeImageUrl?: string;
  barcodeRemoved?: boolean;
};

function formatPrice(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-SA', { dateStyle: 'medium' });
}

function Icon({ name }: { name: 'user' | 'bag' | 'search' | 'location' | 'support' | 'shield' }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const };
  switch (name) {
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>;
    case 'bag':
      return <svg {...common}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>;
    case 'search':
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case 'location':
      return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case 'support':
      return <svg {...common}><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 9c1.2 2.6 2.2 3.6 4.8 5" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }
}

export default function AccountPage() {
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [email, setEmail] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [foundOrder, setFoundOrder] = useState<CheckoutDraft | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [barcodeImageUrl, setBarcodeImageUrl] = useState('');
  const [barcodeRemoved, setBarcodeRemoved] = useState(false);

  useEffect(() => {
    let alive = true;

    try {
      const raw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
      if (raw) {
        const saved = JSON.parse(raw) as CheckoutDraft;
        if (alive && saved && typeof saved === 'object') {
          setDraft(saved);
          if (typeof saved.email === 'string') setEmail(saved.email);
        }
      }
    } catch {
      // Ignore a damaged checkout draft; account details remain usable.
    }

    const key = getCustomerNotificationKey();
    if (key) {
      fetch('/api/customer-notifications?key=' + encodeURIComponent(key), { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) return;
          const data = await response.json() as { notifications?: CustomerNotification[] };
          if (alive && Array.isArray(data.notifications)) setNotifications(data.notifications);
        })
        .catch(() => {
          // Order information stored in this browser remains visible if notifications are unavailable.
        });
    }

    fetch('/api/store-settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as StoreSettings;
        if (!alive) return;
        setWhatsappNumber(typeof data.whatsappNumber === 'string' ? data.whatsappNumber : '');
        setBarcodeImageUrl(typeof data.barcodeImageUrl === 'string' ? data.barcodeImageUrl : '');
        setBarcodeRemoved(data.barcodeRemoved === true);
      })
      .catch(() => {
        // Keep the rest of the account page working if settings are unavailable.
      });

    return () => { alive = false; };
  }, []);

  const address = useMemo(() => {
    if (!draft) return '';
    return [
      draft.regionName || draft.region,
      draft.city,
      draft.neighborhood,
      draft.street,
      draft.building
    ].filter((part) => typeof part === 'string' && part.trim()).join('، ');
  }, [draft]);

  const latestOrderNumber = draft?.orderNumber || notifications[0]?.orderNumber || '';
  const latestStatus = latestOrderNumber
    ? notifications.find((item) => item.orderNumber === latestOrderNumber)?.statusLabel || ''
    : '';

  function handleOrderLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFoundOrder(null);
    setLookupMessage('');

    const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
    if (draft?.orderNumber && draft.email && draft.email.trim().toLocaleLowerCase('en-US') === normalizedEmail) {
      setFoundOrder(draft);
      return;
    }

    setLookupMessage(
      'لم نعثر على طلب بهذا البريد في جلسة المتصفح الحالية. إذا أتممت الشراء من جهاز آخر أو في جلسة سابقة، تواصل مع خدمة العملاء لمساعدتك في المتابعة.'
    );
  }

  const phoneDigits = whatsappNumber.replace(/\D/g, '');
  const whatsappHref = /^\d{10,15}$/.test(phoneDigits)
    ? 'https://wa.me/' + phoneDigits + '?text=' + encodeURIComponent(
        'مرحبًا، أحتاج مساعدة بخصوص ' + (latestOrderNumber ? 'الطلب ' + latestOrderNumber : 'طلب في متجر أرض الجوال')
      )
    : '';

  const knownOrderCount = new Set([
    ...(draft?.orderNumber ? [draft.orderNumber] : []),
    ...notifications.map((item) => item.orderNumber)
  ].filter(Boolean)).size;

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href="/">الرئيسية</Link><span>/</span><strong>حسابي</strong>
      </div>

      <section className={styles.welcome}>
        <div className={styles.welcomeTop}>
          <div className={styles.avatar}><Icon name="user" /></div>
          <div className={styles.welcomeCopy}>
            <small>مساحتك الشخصية</small>
            <h1>{draft?.fullName ? 'أهلًا ' + draft.fullName.split(' ')[0] : 'أهلًا بك'}</h1>
            <p>تابع طلباتك وراجع تفاصيل الشراء، وارجع لبيانات طلبك بسهولة من مكان واحد.</p>
          </div>
        </div>
        <Link href="/" className={styles.goldButton}>متابعة التسوق <span aria-hidden="true">←</span></Link>
      </section>

      <section className={styles.stats} aria-label="ملخص الطلبات">
        <div className={styles.stat}>
          <span>الطلبات المعروفة على هذا الجهاز</span>
          <strong>{knownOrderCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>قيمة آخر طلب محفوظ</span>
          <strong>{draft?.orderNumber ? formatPrice(draft.total) : '—'}</strong>
        </div>
        <div className={styles.stat}>
          <span>آخر طلب</span>
          <strong className={styles.statLast}>{latestOrderNumber || 'لا توجد طلبات'}</strong>
          {latestStatus ? <small>{latestStatus}</small> : null}
        </div>
      </section>
      <p className={styles.scopeNote}>يعرض الملخص الطلب المحفوظ في جلسة المتصفح الحالية وإشعارات هذا الجهاز، وليس سجلًا كاملًا لحساب مسجّل.</p>

      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div className={styles.sectionIcon}><Icon name="bag" /></div>
          <div>
            <h2>طلباتي</h2>
            <p className={styles.sub}>استخدم البريد الإلكتروني الذي أدخلته عند إتمام الطلب على هذا الجهاز.</p>
          </div>
        </div>
        <form className={styles.lookup} onSubmit={handleOrderLookup}>
          <h3>اعثر على طلبك</h3>
          <p className={styles.sub}>أدخل البريد الإلكتروني الذي استخدمته عند إتمام الشراء.</p>
          <label htmlFor="account-email">البريد الإلكتروني</label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setLookupMessage(''); setFoundOrder(null); }}
            required
          />
          <button type="submit" className={styles.greenButton}><Icon name="search" /> عرض الطلبات</button>
        </form>

        {lookupMessage ? <p className={styles.lookupMessage} role="status">{lookupMessage}</p> : null}
        {foundOrder ? (
          <article className={styles.orderResult} aria-live="polite">
            <div className={styles.orderTop}>
              <div><small>رقم الطلب</small><strong dir="ltr">{foundOrder.orderNumber}</strong></div>
              <span className={styles.orderBadge}>{notifications.find((item) => item.orderNumber === foundOrder.orderNumber)?.statusLabel || 'تم تسجيل الطلب'}</span>
            </div>
            {foundOrder.savedAt ? <p className={styles.orderDate}>تاريخ الحفظ: {formatDate(foundOrder.savedAt)}</p> : null}
            <div className={styles.orderItems}>
              {(foundOrder.items || []).map((item, index) => (
                <div className={styles.orderItem} key={(item.name || 'product') + '-' + index}>
                  <span>{item.name || 'منتج'}{item.color ? ' · ' + item.color : ''} × {item.quantity || 1}</span>
                  <strong>{formatPrice((item.unitPrice || 0) * (item.quantity || 1))}</strong>
                </div>
              ))}
            </div>
            <div className={styles.orderTotal}><span>إجمالي الطلب</span><strong>{formatPrice(foundOrder.total)}</strong></div>
          </article>
        ) : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div className={styles.sectionIcon}><Icon name="user" /></div>
          <div>
            <h2>بيانات التواصل</h2>
            <p className={styles.sub}>البيانات المحفوظة مع آخر طلب في هذه الجلسة.</p>
          </div>
        </div>
        <div className={styles.infoRow}><span>الاسم</span><strong>{draft?.fullName || '—'}</strong></div>
        <div className={styles.infoRow}><span>البريد الإلكتروني</span><strong className={styles.breakWord} dir={draft?.email ? 'ltr' : undefined}>{draft?.email || '—'}</strong></div>
        <div className={styles.infoRow}><span>الجوال</span><strong dir={draft?.phone ? 'ltr' : undefined}>{draft?.phone || '—'}</strong></div>
        <div className={styles.infoRow}><span>العنوان</span><strong>{address || '—'}</strong></div>
      </section>

      <section className={styles.card + ' ' + styles.helpCard}>
        <div className={styles.cardHeading}>
          <div className={styles.sectionIcon}><Icon name="support" /></div>
          <div>
            <h2>تحتاج مساعدة في طلبك؟</h2>
            <p className={styles.sub}>أرسل لنا رقم الطلب وسنساعدك في المتابعة.</p>
          </div>
        </div>
        {whatsappHref ? (
          <a className={styles.whatsappButton} href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <Icon name="support" /> تواصل عبر واتساب
          </a>
        ) : (
          <p className={styles.sub}>رقم واتساب الدعم غير متاح حاليًا. يمكنك استخدام بيانات التواصل الموجودة في تذييل المتجر.</p>
        )}
      </section>

      <section className={styles.credentials}>
        <div className={styles.credentialsCopy}>
          <div className={styles.sectionIcon}><Icon name="shield" /></div>
          <div>
            <h2>التوثيقات والاعتمادات</h2>
            <p className={styles.sub}>الوثائق والباركود المعتمد الذي أضافته إدارة المتجر، إن توفر.</p>
          </div>
        </div>
        {barcodeImageUrl ? (
          <a href={barcodeImageUrl} target="_blank" rel="noopener noreferrer" className={styles.barcodeLink}>
            <img src={barcodeImageUrl} alt="باركود المتجر" width={112} height={112} />
            <span>اضغط لعرض الباركود</span>
          </a>
        ) : (
          <p className={styles.noBarcode}>{barcodeRemoved ? 'تمت إزالة الباركود من إعدادات المتجر.' : 'لم تُضف وثيقة أو باركود إلى هذه الصفحة بعد.'}</p>
        )}
      </section>
    </main>
  );
}
