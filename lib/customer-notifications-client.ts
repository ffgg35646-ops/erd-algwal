'use client';

const STORAGE_KEY = 'erd-algwal-customer-notification-key-v1';

function createKey() {
  if (typeof window === 'undefined') return '';
  if (typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getCustomerNotificationKey() {
  if (typeof window === 'undefined') return '';

  for (const storageName of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[storageName];
      const existing = storage.getItem(STORAGE_KEY);
      if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
        return existing;
      }
      const key = createKey();
      storage.setItem(STORAGE_KEY, key);
      return key;
    } catch {
      // Try the next browser storage option.
    }
  }

  return createKey();
}
