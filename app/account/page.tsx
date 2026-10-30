'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import styles from './account.module.css';
import { CUSTOMER_EMAIL_STORAGE_KEY, getCustomerNotificationKey } from '@/lib/customer-notifications-client';

type SavedOrderItem = {
  name: string;
  quantity: number;
  unitPrice?: number;
  color?: string;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  installment: boolean;
  notes: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: SavedOrderItem[];
  total: number;
  currency: string;
};

type StoreSettings = {
  whatsappNumber?: string;
  barcodeImageUrl?: string;
  barcodeRemoved?: boolean;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  shipped: 'تم الشحن',
  completed: 'مكتمل',
  cancelled: 'ملغي'
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار الدفع',
  paid: 'مدفوع',
  not_recorded: 'غير مسجل',
  failed: 'تعذر الدفع'
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
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

function Icon({ name }: { name: 'user' | 'bag' | 'search' | 'support' | 'shield' }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const };
  switch (name) {
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>;
    case 'bag':
      return <svg {...common}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>;
    case 'search':
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case 'support':
      return <svg {...common}><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 9c1.2 2.6 2.2 3.6 4.8 5" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }
}

export default function AccountPage() {
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [barcodeImageUrl, setBarcodeImageUrl] = useState('');
  const [barcodeRemoved, setBarcodeRemoved] = useState(false);

  async function loadOrders() {
    const key = getCustomerNotificationKey();
    if (!key) {
      setLookupMessage('تعذر قراءة بيانات هذا المتصفح. حدّث الصفحة وحاول مرة أخرى.');
      setOrdersLoaded(true);
      return;
    }

    setOrdersLoading(true);
    setLookupMessage('');
    try {
      const response = await fetch('/api/orders?key=' + encodeURIComponent(key), { cache: 'no-store' });
      const data = await response.json() as { ok?: boolean; orders?: CustomerOrder[]; error?: string };
      if (!response.ok || !data.ok || !Array.isArray(data.orders)) {
        throw new Error(data.error || 'تعذر تحميل تاريخ الطلبات.');
      }
      setOrders(data.orders);
      setOrdersLoaded(true);
      if (!data.orders.length) setLookupMessage('لا توجد طلبات مسجلة من هذا المتصفح حتى الآن.');
    } catch (error) {
      setLookupMessage(error instanceof Error ? error.message : 'تعذر تحميل تاريخ الطلبات.');
      setOrdersLoaded(true);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    let savedEmail = '';
    try {
      savedEmail = window.localStorage.getItem(CUSTOMER_EMAIL_STORAGE_KEY) || '';
      if (alive) setEmail(savedEmail);
    } catch {
      // The email field remains usable if browser storage is unavailable.
    }

    if (savedEmail.trim()) void loadOrders();

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
        // Keep the account page usable if store settings are unavailable.
      });

    return () => { alive = false; };
  }, []);

  function handleEmailChange(value: string) {
    setEmail(value);
    setLookupMessage('');
    try {
      window.localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, value);
    } catch {
      // The current page still reflects the entered email.
    }
  }

  async function handleOrderLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setLookupMessage('اكتب بريدك الإلكتروني أولًا.');
      return;
    }
    try {
      window.localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, normalizedEmail);
    } catch {
      // Continue with the current browser session if storage is unavailable.
    }
    await loadOrders();
  }

  const latestOrder = orders[0];
  const latestOrderNumber = latestOrder?.orderNumber || '';
  const latestStatus = latestOrder ? ORDER_STATUS_LABELS[latestOrder.status] || latestOrder.status : '';
  const totalOrderValue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  const phoneDigits = whatsappNumber.replace(/\D/g, '');
  const whatsappHref = /^\d{10,15}$/.test(phoneDigits)
    ? 'https://wa.me/' + phoneDigits + '?text=' + encodeURIComponent(
        'مرحبًا، أحتاج مساعدة بخصوص ' + (latestOrderNumber ? 'الطلب ' + latestOrderNumber : 'طلب في متجر أرض الجوال')
      )
    : '';

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
            <h1>أهلًا بك</h1>
            <p>تابع مشترياتك وتفاصيل طلباتك من مكان واحد.</p>
          </div>
        </div>
        <Link href="/" className={styles.goldButton}>متابعة التسوق <span aria-hidden="true">←</span></Link>
      </section>

      <section className={styles.stats} aria-label="ملخص الطلبات">
        <div className={styles.stat}>
          <span>عدد الطلبات</span>
          <strong>{orders.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>إجمالي قيمة الطلبات</span>
          <strong>{orders.length ? formatPrice(totalOrderValue) : '—'}</strong>
        </div>
        <div className={styles.stat}>
          <span>آخر طلب</span>
          <strong className={styles.statLast}>{latestOrderNumber || 'لا توجد طلبات'}</strong>
          {latestStatus ? <small>{latestStatus}</small> : null}
        </div>
      </section>
      <p className={styles.scopeNote}>تاريخ الطلبات يعرض الطلبات المحفوظة في قاعدة بيانات المتجر من هذا المتصفح.</p>

      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div className={styles.sectionIcon}><Icon name="bag" /></div>
          <div>
            <h2>طلباتي — تاريخ الطلبات</h2>
            <p className={styles.sub}>كل طلبات الشراء المسجلة من هذا المتصفح وتفاصيل كل طلب.</p>
          </div>
        </div>

        <form className={styles.lookup} onSubmit={handleOrderLookup}>
          <h3>اعثر على طلبك</h3>
          <p className={styles.sub}>اكتب بريدك الإلكتروني وسيظل محفوظًا في هذا المتصفح.</p>
          <label htmlFor="account-email">البريد الإلكتروني</label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            required
          />
          <button type="submit" className={styles.greenButton} disabled={ordersLoading}>
            <Icon name="search" /> {ordersLoading ? 'جاري تحميل الطلبات...' : 'عرض تاريخ الطلبات'}
          </button>
        </form>

        {lookupMessage ? <p className={styles.lookupMessage} role="status">{lookupMessage}</p> : null}
        {ordersLoading && !ordersLoaded ? <p className={styles.sub}>جاري تحميل الطلبات المحفوظة...</p> : null}

        {orders.length ? (
          <div className={styles.ordersList} aria-live="polite">
            {orders.map((order) => (
              <article className={styles.orderResult} key={order.id}>
                <div className={styles.orderTop}>
                  <div>
                    <small>رقم الطلب</small>
                    <strong dir="ltr">{order.orderNumber}</strong>
                  </div>
                  <span className={styles.orderBadge}>{ORDER_STATUS_LABELS[order.status] || order.status || 'مسجل'}</span>
                </div>
                <p className={styles.orderDate}>تاريخ الطلب: {formatDate(order.createdAt)}</p>

                <div className={styles.orderItems}>
                  {(order.items || []).map((item, index) => (
                    <div className={styles.orderItem} key={order.id + '-' + index}>
                      <span>
                        {item.name || 'منتج'}
                        {item.color ? ' · اللون: ' + item.color : ''}
                        {' × '}{item.quantity || 1}
                        {typeof item.unitPrice === 'number' ? ' — ' + formatPrice(item.unitPrice) + ' للقطعة' : ''}
                      </span>
                      <strong>{formatPrice((item.unitPrice || 0) * (item.quantity || 1))}</strong>
                    </div>
                  ))}
                </div>

                <div className={styles.orderTotal}>
                  <span>إجمالي الطلب</span>
                  <strong>{formatPrice(order.total)}</strong>
                </div>
                <div className={styles.orderDetails}>
                  <span>حالة الدفع: {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus || 'غير محددة'}</span>
                  <span>طريقة الطلب: {order.installment ? 'تقسيط مطلوب' : 'شراء عادي'}</span>
                </div>
                {order.customerAddress ? <p className={styles.orderExtra}>عنوان التوصيل: {order.customerAddress}</p> : null}
                {order.notes ? <p className={styles.orderExtra}>ملاحظات الطلب: {order.notes}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div className={styles.sectionIcon}><Icon name="user" /></div>
          <div>
            <h2>بيانات التواصل</h2>
            <p className={styles.sub}>البريد الإلكتروني المحفوظ لهذا المتصفح.</p>
          </div>
        </div>
        <div className={styles.infoRow}>
          <span>البريد الإلكتروني</span>
          <strong className={styles.breakWord} dir={email ? 'ltr' : undefined}>{email.trim() || 'لم يُضف بريد إلكتروني بعد'}</strong>
        </div>
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
