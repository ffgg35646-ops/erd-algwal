'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCustomerNotificationKey } from '@/lib/customer-notifications-client';

type CustomerNotification = {
  id: string;
  orderNumber: string;
  status: 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  statusLabel: string;
  cancellationReason: string;
  createdAt: string;
  read: boolean;
};

function notificationMessage(item: CustomerNotification) {
  return item.status === 'cancelled' && item.cancellationReason
    ? `${item.statusLabel} · الطلب ${item.orderNumber} · السبب: ${item.cancellationReason}`
    : `${item.statusLabel} · الطلب ${item.orderNumber}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CustomerNotifications() {
  const [key, setKey] = useState('');
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<CustomerNotification | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    setKey(getCustomerNotificationKey());
  }, []);

  const refresh = useCallback(async () => {
    if (!key) return;

    try {
      const response = await fetch('/api/customer-notifications?key=' + encodeURIComponent(key), {
        cache: 'no-store'
      });
      if (!response.ok) return;
      const data = await response.json() as {
        ok?: boolean;
        unreadCount?: number;
        notifications?: CustomerNotification[];
      };
      if (!data.ok || !Array.isArray(data.notifications)) return;

      const incoming = data.notifications;
      if (initialized.current) {
        const newest = incoming.find((item) => !knownIds.current.has(item.id));
        if (newest) setToast(newest);
      }
      for (const item of incoming) knownIds.current.add(item.id);
      initialized.current = true;
      setNotifications(incoming);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch {
      // Keep the bell and the last loaded notifications usable during brief network errors.
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15_000);
    const handleFocus = () => { void refresh(); };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [key, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function toggleBell() {
    const opening = !isOpen;
    setIsOpen(opening);
    setToast(null);
    if (!opening || !key || unreadCount === 0) return;

    try {
      const response = await fetch('/api/customer-notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, action: 'mark-read' })
      });
      if (!response.ok) return;
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch {
      // The next poll will retry the server state.
    }
  }

  return (
    <div className="customer-notifications">
      <button
        className="notification-bell"
        type="button"
        aria-label={unreadCount ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'}
        aria-expanded={isOpen}
        title="الإشعارات"
        onClick={() => { void toggleBell(); }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <section className="notification-panel" aria-label="إشعارات الطلبات">
          <div className="notification-panel-head">
            <strong>الإشعارات</strong>
            <button type="button" className="notification-close" aria-label="إغلاق الإشعارات" onClick={() => setIsOpen(false)}>×</button>
          </div>
          {notifications.length === 0 ? (
            <div className="notification-empty">لا توجد إشعارات حتى الآن.</div>
          ) : (
            <div className="notification-list">
              {notifications.map((item) => (
                <article className={item.read ? 'notification-item' : 'notification-item notification-item-unread'} key={item.id}>
                  <span className="notification-item-dot" aria-hidden="true" />
                  <div className="notification-item-body">
                    <strong className={item.status === 'cancelled' ? 'notification-status notification-status-cancelled' : 'notification-status'}>
                      {item.statusLabel}
                    </strong>
                    <p>الطلب: {item.orderNumber}</p>
                    {item.status === 'cancelled' && item.cancellationReason && (
                      <p className="notification-cancellation-reason">سبب الإلغاء: {item.cancellationReason}</p>
                    )}
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {toast && (
        <div className="notification-toast" role="status" aria-live="polite">
          <strong>إشعار جديد</strong>
          <span>{notificationMessage(toast)}</span>
          <button type="button" aria-label="إغلاق التنبيه" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}
