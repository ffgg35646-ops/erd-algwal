import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const STORE_CONTENT_PAGES = {
  privacy: {
    title: 'سياسة الخصوصية',
    group: 'policies',
    fallback: 'لم تتم إضافة نص سياسة الخصوصية بعد. للاستفسار، يرجى التواصل مع خدمة العملاء.'
  },
  terms: {
    title: 'الشروط والأحكام',
    group: 'policies',
    fallback: 'لم تتم إضافة نص الشروط والأحكام بعد. يرجى مراجعة النص المحدث قبل استخدام خدمات المتجر.'
  },
  returns: {
    title: 'الاستبدال والاسترجاع',
    group: 'policies',
    fallback: 'لم تتم إضافة نص سياسة الاستبدال والاسترجاع بعد. يرجى التواصل مع خدمة العملاء لمعرفة الشروط المعتمدة.'
  },
  shipping: {
    title: 'الشحن والتوصيل',
    group: 'customer-service',
    fallback: 'لم تتم إضافة تفاصيل الشحن والتوصيل بعد. تواصل مع خدمة العملاء لتأكيد تفاصيل طلبك.'
  },
  'payment-methods': {
    title: 'طرق الدفع',
    group: 'customer-service',
    fallback: 'لم تتم إضافة طرق الدفع بعد. تواصل مع خدمة العملاء لمعرفة الطرق المتاحة حاليًا.'
  },
  ordering: {
    title: 'طلب الدفع والشراء',
    group: 'customer-service',
    fallback: 'لم تتم إضافة تعليمات الطلب والشراء بعد. يمكنك اختيار المنتجات وإضافتها إلى السلة ثم متابعة خطوات إتمام الطلب.'
  },
  faq: {
    title: 'الأسئلة الشائعة',
    group: 'customer-service',
    fallback: 'لم تتم إضافة الأسئلة الشائعة بعد. أرسل استفسارك إلى خدمة العملاء وسنساعدك.'
  }
} as const;

export type StoreContentKey = keyof typeof STORE_CONTENT_PAGES;

export async function GET() {
  const noStore = { 'cache-control': 'no-store, max-age=0' };
  const keys = Object.keys(STORE_CONTENT_PAGES) as StoreContentKey[];
  const defaults = keys.map((key) => ({
    key,
    title: STORE_CONTENT_PAGES[key].title,
    group: STORE_CONTENT_PAGES[key].group,
    content: STORE_CONTENT_PAGES[key].fallback,
    updatedAt: null as string | null
  }));

  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ pages: defaults }, { headers: noStore });
  }

  try {
    const db = await getDb();
    const docs = await db.collection('store_pages')
      .find({ _id: { $in: keys } })
      .toArray();
    const saved = new Map(docs.map((doc) => [String(doc._id), doc] as const));
    const pages = keys.map((key) => {
      const doc = saved.get(key);
      const content = typeof doc?.content === 'string' ? doc.content : STORE_CONTENT_PAGES[key].fallback;
      return {
        key,
        title: STORE_CONTENT_PAGES[key].title,
        group: STORE_CONTENT_PAGES[key].group,
        content,
        updatedAt: doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null
      };
    });
    return NextResponse.json({ pages }, { headers: noStore });
  } catch (error) {
    console.error('Store content load failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ pages: defaults }, { headers: noStore });
  }
}
