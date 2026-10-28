'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Review = { id: string; name: string; comment: string; rating?: number; createdAt: string; isDemo?: boolean };
const EXAMPLE_REVIEWS: Review[] = [
  {
    "id": "sample-1",
    "name": "فهد العتيبي",
    "comment": "التصميم سريع وواضح، وسهل ألقى الجوال المناسب.",
    "rating": 4,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-2",
    "name": "نورة القحطاني",
    "comment": "خطوات الطلب بسيطة، والتواصل واضح من البداية.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-3",
    "name": "عبدالله الحربي",
    "comment": "عرض تفاصيل المنتجات مرتب وسهل القراءة.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-4",
    "name": "سارة الدوسري",
    "comment": "التنقل بين الأقسام مريح وسريع.",
    "rating": 4,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-5",
    "name": "تركي الغامدي",
    "comment": "السلة واضحة ومراجعة الطلب سهلة.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-6",
    "name": "ريم المطيري",
    "comment": "طريقة عرض الأسعار تساعد في المقارنة.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-7",
    "name": "خالد الزهراني",
    "comment": "أعجبني وضوح خيارات الأجهزة وملحقاتها.",
    "rating": 4,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-8",
    "name": "الجوهرة العنزي",
    "comment": "تفاصيل الطلب مرتبة وما فيها تعقيد.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-9",
    "name": "فيصل الشهري",
    "comment": "واجهة المتجر خفيفة حتى على الجوال.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-10",
    "name": "منيرة السبيعي",
    "comment": "الصور الكبيرة تسهل اختيار المنتج.",
    "rating": 4,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-11",
    "name": "مشعل الشمري",
    "comment": "الوصول لخدمة العملاء واضح وسهل.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  },
  {
    "id": "sample-12",
    "name": "لولوة المالكي",
    "comment": "تجربة التصفح بسيطة ومنظمة.",
    "rating": 5,
    "createdAt": "",
    "isDemo": true
  }
];
type Prompt = { orderId: string; orderNumber: string } | null;

export default function CustomerReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [token, setToken] = useState('');
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (currentToken: string) => {
    try {
      const response = await fetch('/api/reviews' + (currentToken ? '?token=' + encodeURIComponent(currentToken) : ''), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) return;
      setReviews(Array.isArray(data.reviews) ? data.reviews : EXAMPLE_REVIEWS);
      if (data.prompt) {
        setPrompt((previous) => previous?.orderId === data.prompt.orderId ? previous : data.prompt);
        setMessage('');
      } else {
        setPrompt(null);
      }
    } catch { /* Keep the storefront usable when the network is unavailable. */ }
  }, []);

  useEffect(() => {
    let currentToken = '';
    try {
      currentToken = window.localStorage.getItem('erd-algwal-review-token') || '';
      if (!currentToken) {
        currentToken = window.crypto.randomUUID();
        window.localStorage.setItem('erd-algwal-review-token', currentToken);
      }
    } catch { /* Browser storage may be disabled. */ }
    setToken(currentToken);
    void load(currentToken);
    const timer = window.setInterval(() => void load(currentToken), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, orderId: prompt.orderId, name, comment, ...(rating ? { rating } : {}) })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر إرسال التعليق.');
      setPrompt(null); setName(''); setComment(''); setRating(null);
      setMessage('شكرًا لك، تم إرسال تعليقك.');
      await load(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إرسال التعليق.');
    } finally { setSaving(false); }
  }

  return (
    <section className="customer-reviews" aria-labelledby="customer-reviews-title">
      <div className="customer-reviews-heading">
        <div><span className="reviews-kicker">آراء وتجارب العملاء</span><h2 id="customer-reviews-title">آراء العملاء</h2><p>يسعدنا نعرف رأيك في تجربتك مع أرض الجوال.</p></div>
        <span className="reviews-count">{reviews.length} تعليق</span>
      </div>
      {reviews.length ? (
        <div className="reviews-track" aria-label="آراء العملاء المتحركة تلقائيًا">
          <div className="reviews-marquee-track">
            {[0, 1].map((copy) => (
              <div className="reviews-marquee-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                {reviews.map((review) => <article className="review-card" key={copy + '-' + review.id}>
                  {review.rating ? <div className="review-stars" aria-label={'تقييم ' + review.rating + ' من 5'}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></div> : null}
                  <p>{review.comment}</p><strong>{review.name}</strong>
                </article>)}
              </div>
            ))}
          </div>
        </div>
      ) : <div className="reviews-empty">آراء عملائنا تظهر هنا بعد إرسالها.</div>}
      {message ? <p className="review-feedback" role="status">{message}</p> : null}
      {prompt ? <div className="review-modal-backdrop" role="presentation">
        <form className="review-modal" onSubmit={submitReview} aria-label="إضافة تقييم للطلب">
          <button className="review-modal-close" type="button" onClick={() => setPrompt(null)} aria-label="إغلاق">×</button>
          <span className="reviews-kicker">طلب مكتمل</span>
          <h3>هل تريد إضافة تقييم للطلب؟</h3>
          <p>رقم الطلب: {prompt.orderNumber}</p>
          <label>الاسم<input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك" /></label>
          <label>التقييم (اختياري)<div className="review-rating-picker">{[1,2,3,4,5].map((star) => <button type="button" key={star} aria-label={star + ' نجوم'} aria-pressed={rating === star} className={rating !== null && star <= rating ? 'selected' : ''} onClick={() => setRating(rating === star ? null : star)}>★</button>)}</div></label>
          <label>تعليقك<textarea required minLength={3} maxLength={700} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="شاركنا تجربتك..." /></label>
          <button className="review-submit" type="submit" disabled={saving}>{saving ? 'جارٍ الإرسال...' : 'إرسال التعليق'}</button>
          {message ? <p role="status">{message}</p> : null}
        </form>
      </div> : null}
    </section>
  );
}
