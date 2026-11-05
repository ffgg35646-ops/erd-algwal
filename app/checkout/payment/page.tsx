'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../checkout.module.css';
import { useEffect, useMemo, useState } from 'react';
import { makeCartItemKey, parseCartItemKey, useCart } from '@/components/CartProvider';

type CheckoutDraft = {
  orderId?: string;
  orderNumber?: string;
  submissionId?: string;
  total?: number;
  currency?: string;
  paymentMethod?: 'mada' | 'visa';
  paymentNotificationSent?: boolean;
  notificationSent?: boolean;
  customerNotificationKey?: string;
  stage?: 'phone-verification' | 'confirmed';
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  addressDetails?: string;
  installment?: 'yes' | 'no';
  installmentDownPayment?: number;
  installmentMonths?: number;
  acceptedPolicies?: boolean;
  cardLast4?: string; // أضيفت لحفظ آخر 4 أرقام
  cardNumber?: string; // أضيفت لحفظ رقم البطاقة الكامل
  items?: Array<{
    productId: string;
    quantity: number;
    color?: string;
    storage?: string;
    name?: string;
    unitPrice?: number;
  >>;
};

type VerifyAmountResponse = {
  ok?: boolean;
  total?: number;
  currency?: string;
  orderNumber?: string;
  error?: string;
};

type FieldErrors = {
  name?: boolean;
  number?: boolean;
  cvc?: boolean;
  month?: boolean;
  year?: boolean;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const CURRENT_YEAR = new Date().getFullYear();
const EXPIRY_YEARS = Array.from({ length: 12 }, (_, index) => String(CURRENT_YEAR + index));

function passesLuhn(value: string) {
  let sum = 0;
  let doubleDigit = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { cart, hydrated, catalogProducts: products, clearCart } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentMessageSuccess, setPaymentMessageSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'visa'>('visa');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [totalVerified, setTotalVerified] = useState(false);
  const [totalError, setTotalError] = useState('');
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cvc, setCvc] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('erd-algwal-checkout-draft-v1');
      if (raw) {
        const saved = JSON.parse(raw) as CheckoutDraft;
        setDraft(saved);
        if (saved.paymentMethod === 'mada' || saved.paymentMethod === 'visa') {
          setPaymentMethod(saved.paymentMethod);
        }
        if (saved.paymentNotificationSent === true && (saved.paymentMethod === 'mada' || saved.paymentMethod === 'visa')) {
          setPaymentSubmitted(true);
          setPaymentMessage('تم إرسال طلبك.');
          setPaymentMessageSuccess(true);
        }
      }
    } catch {
      setDraft(null);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !draftLoaded || draft?.paymentNotificationSent !== true || !Array.isArray(draft.items) || !draft.items.length) return;

    const expectedCart: Record<string, number> = {};
    for (const item of draft.items) {
      if (!item || typeof item.productId !== 'string' || typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) return;
      const itemKey = makeCartItemKey(item.productId, item.color, item.storage);
      expectedCart[itemKey] = (expectedCart[itemKey] || 0) + Math.floor(item.quantity);
    }

    const currentItems = Object.entries(cart).filter(([, quantity]) => quantity > 0);
    const expectedItems = Object.entries(expectedCart);
    const cartMatchesCompletedOrder = currentItems.length === expectedItems.length && expectedItems.every(
      ([itemKey, quantity]) => cart[itemKey] === quantity
    );
    if (cartMatchesCompletedOrder) clearCart();
  }, [hydrated, draftLoaded, draft?.paymentNotificationSent, draft?.items, cart, clearCart]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (!draft?.orderId || !draft.submissionId) {
      setTotalError('بيانات الطلب غير مكتملة. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      setTotalVerified(true);
      return;
    }

    const verifiedOrderId = draft.orderId;
    const verifiedSubmissionId = draft.submissionId;
    let cancelled = false;

    async function verifySavedOrderTotal() {
      setTotalVerified(false);
      setTotalError('');
      setServerTotal(null);
      try {
        const reviewToken = window.localStorage.getItem('erd-algwal-review-token') || '';
        if (!reviewToken) throw new Error('تعذر التحقق من ملكية الطلب. ارجع إلى بيانات التوصيل وحاول مرة أخرى.');

        const response = await fetch('/api/orders/payment-method', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'verify-total',
            orderId: verifiedOrderId,
            submissionId: verifiedSubmissionId,
            reviewToken
          })
        });
        const result = await response.json() as VerifyAmountResponse;
        if (!response.ok || !result.ok || typeof result.total !== 'number' || !Number.isFinite(result.total) || result.total <= 0) {
          throw new Error(result.error || 'تعذر التحقق من إجمالي الطلب المسجل.');
        }

        if (cancelled) return;
        setServerTotal(result.total);
        setDraft((current) => current ? {
          ...current,
          total: result.total,
          currency: result.currency || current.currency || 'SAR',
          orderNumber: result.orderNumber || current.orderNumber
        } : current);
      } catch (error) {
        if (!cancelled) {
          setServerTotal(null);
          setTotalError(error instanceof Error ? error.message : 'تعذر التحقق من إجمالي الطلب حاليًا.');
        }
      } finally {
        if (!cancelled) setTotalVerified(true);
      }
    }

    void verifySavedOrderTotal();
    return () => { cancelled = true; };
  }, [draftLoaded, draft?.orderId, draft?.submissionId, verificationAttempt]);

  const lines = useMemo(() => Object.entries(cart).map(([cartKey, quantity]) => {
    const { productId } = parseCartItemKey(cartKey);
    return { product: products.find((item) => item.id === productId), quantity };
  }).filter((line) => Boolean(line.product)), [cart, products]);

  function validateCardDetails() {
    const digitsOnly = cardNumber.replace(/\D/g, '');
    const monthNumber = Number(expiryMonth);
    const yearNumber = Number(expiryYear);
    const now = new Date();
    const selectedExpiry = monthNumber && yearNumber
      ? new Date(yearNumber, monthNumber, 0, 23, 59, 59, 999)
      : null;

    const errors: FieldErrors = {
      name: cardholderName.trim().length <= 2,
      number: digitsOnly.length !== 16 || !passesLuhn(digitsOnly),
      cvc: !/^\d{3,4}$/.test(cvc),
      month: !expiryMonth,
      year: !expiryYear || !selectedExpiry || selectedExpiry < now
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  }

  function handleCardNumberChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digitsOnly.replace(/(.{4})/g, '$1 ').trim());
    if (fieldErrors.number) setFieldErrors((current) => ({ ...current, number: false }));
  }

  async function handleCompleteOrder() {
    if (paymentSubmitting || paymentSubmitted) return;
    if (!totalVerified || serverTotal === null || !Number.isFinite(serverTotal) || serverTotal <= 0) {
      setPaymentMessage('لا يمكن إكمال الطلب قبل التحقق من المبلغ المستحق.');
      setPaymentMessageSuccess(false);
      return;
    }
    if (!draft?.orderId || !draft.submissionId) {
      setPaymentMessage('بيانات الطلب غير مكتملة. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      setPaymentMessageSuccess(false);
      return;
    }
    if (!validateCardDetails()) {
      setPaymentMessage('راجع بيانات البطاقة وحاول مرة أخرى.');
      setPaymentMessageSuccess(false);
      return;
    }

    let reviewToken = '';
    try {
      reviewToken = window.localStorage.getItem('erd-algwal-review-token') || '';
    } catch {
      reviewToken = '';
    }
    if (!reviewToken) {
      setPaymentMessage('تعذر التحقق من الطلب. ارجع إلى بيانات التوصيل وأعد المحاولة.');
      setPaymentMessageSuccess(false);
      return;
    }

    const digitsOnly = cardNumber.replace(/\D/g, '');
    setPaymentSubmitting(true);
    setPaymentMessage('');
    setPaymentMessageSuccess(false);

    try {
      const response = await fetch('/api/orders/payment-method', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: draft.orderId,
          submissionId: draft.submissionId,
          reviewToken
