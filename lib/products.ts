export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  image: string;
  shortDescription: string;
  description: string;
  specifications: string[];
  categoryId?: string;
  colors?: string[];
  storageOptions?: string[];
  images?: string[];
};

export const categories = [
  { name: 'آيفون', icon: '', description: 'أجهزة آيفون' },
  { name: 'سامسونج', icon: '◈', description: 'أحدث أجهزة جالاكسي' },
  { name: 'سماعات', icon: '♫', description: 'صوتك معاك في كل مكان' },
  { name: 'شواحن', icon: 'ϟ', description: 'شحن سريع وآمن' },
  { name: 'إكسسوارات', icon: '✦', description: 'كل ما تحتاجه لجوالك' }
];

export const products: Product[] = [
  {
    id: 'iphone-pro',
    name: 'iPhone Pro',
    category: 'آيفون',
    price: 4899,
    oldPrice: 5299,
    badge: 'الأكثر طلبًا',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=85',
    shortDescription: 'أداء قوي وتصميم أنيق وتجربة تصوير متقدمة.',
    description: 'جوال بتصميم مميز وأداء سريع يناسب الاستخدام اليومي والتصوير والترفيه. هذه بيانات تجريبية قابلة للتعديل لاحقًا من بوت الإدارة.',
    specifications: ['تصميم أنيق ومتين', 'كاميرا عالية الجودة', 'أداء سريع', 'ضمان حسب سياسة المتجر']
  },
  {
    id: 'galaxy-ultra',
    name: 'Galaxy Ultra',
    category: 'سامسونج',
    price: 4299,
    oldPrice: 4599,
    badge: 'عرض مميز',
    image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=900&q=85',
    shortDescription: 'شاشة رائعة وتجربة استخدام سلسة.',
    description: 'جهاز مناسب للعمل والترفيه مع شاشة كبيرة وتصميم عصري. الاسم والمواصفات والأسعار هنا أمثلة أولية وليست كتالوجًا نهائيًا.',
    specifications: ['شاشة كبيرة وواضحة', 'بطارية للاستخدام اليومي', 'تصميم عصري', 'ضمان حسب سياسة المتجر']
  },
  {
    id: 'iphone-standard',
    name: 'iPhone',
    category: 'آيفون',
    price: 3299,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85',
    shortDescription: 'اختيار عملي للاستخدام اليومي.',
    description: 'خيار أنيق للاستخدام اليومي والتواصل والتصوير. يمكن استبدال كل بيانات المنتج من لوحة إدارة البوت عند بناء الربط.',
    specifications: ['واجهة سهلة الاستخدام', 'كاميرا عملية', 'تصميم خفيف', 'ضمان حسب سياسة المتجر']
  },
  {
    id: 'wireless-headphones',
    name: 'سماعات لاسلكية',
    category: 'سماعات',
    price: 249,
    oldPrice: 299,
    badge: 'خصم',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85',
    shortDescription: 'صوت واضح وتصميم مريح.',
    description: 'سماعات لاسلكية للاستخدام أثناء التنقل والعمل والاستماع اليومي. الصورة والسعر للتجربة التصميمية.',
    specifications: ['اتصال لاسلكي', 'تصميم مريح', 'مناسبة للاستخدام اليومي']
  },
  {
    id: 'fast-charger',
    name: 'شاحن سريع',
    category: 'شواحن',
    price: 89,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=85',
    shortDescription: 'شحن عملي في المنزل والعمل.',
    description: 'شاحن للاستخدام اليومي. يجب اعتماد قدرة الشحن وتوافق الأجهزة قبل نشر المنتج للبيع.',
    specifications: ['تصميم صغير', 'سهل الحمل', 'تحقق من توافق الجهاز قبل الشراء']
  },
  {
    id: 'phone-accessory',
    name: 'إكسسوار للجوال',
    category: 'إكسسوارات',
    price: 59,
    image: 'https://images.unsplash.com/photo-1603313011100-3b7d13a68c61?auto=format&fit=crop&w=900&q=85',
    shortDescription: 'لمسة إضافية لحماية جوالك.',
    description: 'منتج إكسسوارات تجريبي. يتم استبدال الصورة والوصف والسعر بالبيانات الفعلية عبر بوت الإدارة مستقبلًا.',
    specifications: ['تصميم عملي', 'خفيف الوزن', 'يرجى التحقق من توافق الموديل']
  }
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0
  }).format(value);
}

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}
