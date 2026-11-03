export type ProductColorMask = {
  version: 1;
  sourceColor: string;
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Base64-encoded, MSB-first bit-packed mask: 1 = case, 0 = outside. */
  encoding: 'bit-packed-msb';
  data: string;
  model: 'sam-3.1' | 'manual-brush-v1';
  generatedAt: string | Date;
};

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
  storagePrices?: Record<string, number>;
  images?: string[];
  colorMask?: ProductColorMask;
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
  },
  {
      "id": "iphone-18-pro-max-256",
      "name": "iPhone 18 Pro Max — 256GB",
      "category": "آيفون",
      "price": 6149,
      "badge": "الأحدث",
      "image": "https://www.apple.com/newsroom/images/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/article/Apple-iPhone-18-Pro-2up-260909_inline.jpg.large.jpg",
      "shortDescription": "أكبر شاشة Pro وأقوى تجربة تصوير وأداء مع شريحة A20 Pro.",
      "description": "هاتف Apple iPhone 18 Pro Max بسعة 256GB، يجمع بين شاشة Super Retina XDR OLED مقاس 6.9 بوصة وشريحة A20 Pro ونظام كاميرات Pro Fusion بدقة 48 ميجابكسل. مناسب للتصوير الاحترافي والألعاب والعمل ومشاهدة المحتوى، مع تصميم من الألومنيوم وواجهة وخلفية Ceramic Shield 2.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.9 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A20 Pro",
        "الكاميرات الخلفية: نظام Pro Fusion بثلاث كاميرات 48MP مع فتحة عدسة رئيسية متغيرة",
        "الكاميرا الأمامية: 18MP Center Stage",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: أسود، فضي، جليدي، خمري",
        "مقاومة الماء والغبار: IP68",
        "الاتصال: 5G وWi‑Fi 7 وBluetooth 6",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أسود",
        "فضي",
        "جليدي",
        "خمري"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-18-pro-256",
      "name": "iPhone 18 Pro — 256GB",
      "category": "آيفون",
      "price": 5749,
      "badge": "جديد",
      "image": "https://www.apple.com/newsroom/images/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/article/Apple-iPhone-18-Pro-color-lineup-260909_big.jpg.large.jpg",
      "shortDescription": "أداء A20 Pro وتصوير احترافي في حجم عملي بشاشة 6.3 بوصة.",
      "description": "هاتف Apple iPhone 18 Pro بسعة 256GB، مزود بشريحة A20 Pro وشاشة Super Retina XDR OLED مقاس 6.3 بوصة. يقدم نظام كاميرات Pro Fusion بدقة 48MP مع فتحة عدسة رئيسية متغيرة وتحكمات تصوير متقدمة، داخل تصميم ألومنيوم مع Ceramic Shield 2.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.3 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A20 Pro",
        "الكاميرات الخلفية: نظام Pro Fusion بثلاث كاميرات 48MP",
        "فتحة عدسة رئيسية متغيرة وتحكمات Pro للتصوير",
        "الكاميرا الأمامية: 18MP Center Stage",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: أسود، فضي، جليدي، خمري",
        "مقاومة الماء والغبار: IP68",
        "الاتصال: 5G وWi‑Fi 7 وBluetooth 6",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أسود",
        "فضي",
        "جليدي",
        "خمري"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-17-pro-max-256",
      "name": "iPhone 17 Pro Max — 256GB",
      "category": "آيفون",
      "price": 5249,
      "badge": "الأكثر طلبًا",
      "image": "https://cdn.mwave.com.au/images/400/apple_iphone_17_pro_max_512gb_cosmic_orange_ac89353_91825.jpg",
      "shortDescription": "شاشة كبيرة ونظام كاميرات Pro وأداء قوي بمعالج A19 Pro.",
      "description": "هاتف Apple iPhone 17 Pro Max بسعة 256GB، مصمم لمن يريد شاشة كبيرة وتجربة تصوير متقدمة. يجمع بين شاشة Super Retina XDR OLED مقاس 6.9 بوصة وشريحة A19 Pro ونظام كاميرات Pro Fusion ثلاثي بدقة 48MP، مع تصميم متين وواجهة Ceramic Shield.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.9 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A19 Pro",
        "الكاميرات الخلفية: نظام Pro Fusion ثلاثي بدقة 48MP",
        "الكاميرا الأمامية: 18MP Center Stage",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: أزرق داكن، برتقالي كوني، فضي",
        "اتصال 5G وUSB‑C",
        "مقاومة الماء والغبار حسب معيار IP68",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أزرق داكن",
        "برتقالي",
        "فضي"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-17-pro-256",
      "name": "iPhone 17 Pro — 256GB",
      "category": "آيفون",
      "price": 4749,
      "badge": "تصوير احترافي",
      "image": "https://www.pbtech.co.nz/imgprod/M/P/MPHAPP817212.jpg?h=3366490703",
      "shortDescription": "كاميرات Pro وشريحة A19 Pro وشاشة 6.3 بوصة.",
      "description": "هاتف Apple iPhone 17 Pro بسعة 256GB، يقدم أداءً سريعًا مع شريحة A19 Pro وشاشة Super Retina XDR OLED مقاس 6.3 بوصة. نظام الكاميرات Pro Fusion الثلاثي بدقة 48MP يمنح مرونة أكبر في تصوير الصور والفيديو، مع تصميم ألومنيوم متين.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.3 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A19 Pro",
        "الكاميرات الخلفية: نظام Pro Fusion ثلاثي بدقة 48MP",
        "الكاميرا الأمامية: 18MP Center Stage",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: أزرق داكن، برتقالي كوني، فضي",
        "اتصال 5G وUSB‑C",
        "مقاومة الماء والغبار حسب معيار IP68",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أزرق داكن",
        "برتقالي",
        "فضي"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-air-256",
      "name": "iPhone Air — 256GB",
      "category": "آيفون",
      "price": 3799,
      "badge": "تصميم نحيف",
      "image": "https://cdn.beebom.com/mobile/apple-iphone-17-air-front-and-back2.png.png",
      "shortDescription": "تصميم فائق النحافة مع شاشة 6.5 بوصة وأداء Pro.",
      "description": "هاتف Apple iPhone Air بسعة 256GB، يتميز بتصميم نحيف وخفيف مع شاشة Super Retina XDR OLED مقاس 6.5 بوصة وتقنية ProMotion حتى 120Hz. يعمل بشريحة A19 Pro ويقدم كاميرا Fusion بدقة 48MP، ليجمع بين التصميم الأنيق والأداء العالي.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.5 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A19 Pro",
        "الكاميرا الخلفية: 48MP Fusion",
        "الكاميرا الأمامية: 18MP Center Stage",
        "السماكة: 5.64 مم تقريبًا",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: أسود فضائي، أبيض سحابي، ذهبي فاتح، أزرق سماوي",
        "اتصال 5G وUSB‑C",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أسود",
        "أبيض",
        "ذهبي",
        "أزرق"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-17-256",
      "name": "iPhone 17 — 256GB",
      "category": "آيفون",
      "price": 3799,
      "badge": "اختيار متوازن",
      "image": "https://image.vandenborre.be/WEB/images/products/superzoom/apple_iphone-17-256gb-white_7654359_1.jpg",
      "shortDescription": "شاشة 6.3 بوصة ومعالج A19 وكاميرات Fusion بدقة 48MP.",
      "description": "هاتف Apple iPhone 17 بسعة 256GB، خيار متوازن للاستخدام اليومي والتصوير والترفيه. يأتي بشاشة Super Retina XDR OLED مقاس 6.3 بوصة مع ProMotion حتى 120Hz، وشريحة A19، ونظام كاميرات Fusion مزدوج بدقة 48MP.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.3 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A19",
        "الكاميرات الخلفية: كاميرتان Fusion بدقة 48MP",
        "الكاميرا الأمامية: 18MP Center Stage",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: أسود، أبيض، أزرق ضبابي، لافندر، أخضر مريمي",
        "اتصال 5G وUSB‑C",
        "مقاومة الماء والغبار حسب معيار IP68",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أسود",
        "أبيض",
        "أزرق",
        "بنفسجي",
        "أخضر"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-17e-256",
      "name": "iPhone 17e — 256GB",
      "category": "آيفون",
      "price": 2799,
      "badge": "قيمة ممتازة",
      "image": "https://www.istore.co.za/media/catalog/product/cache/2241381b38f9c5524d34c4c939d65433/i/p/iphone_17e_soft_pink_pdp_image_position_1__en-ww_1_1.jpg",
      "shortDescription": "أداء A19 وكاميرا Fusion بدقة 48MP وسعة 256GB.",
      "description": "هاتف Apple iPhone 17e بسعة 256GB، يقدم تجربة iPhone عملية مع شريحة A19 وشاشة Super Retina XDR OLED مقاس 6.1 بوصة وكاميرا Fusion بدقة 48MP. تصميمه مناسب للاستخدام اليومي مع دعم MagSafe.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.1 بوصة",
        "المعالج: Apple A19",
        "الكاميرا الخلفية: 48MP Fusion",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: أسود، أبيض، وردي ناعم",
        "دعم MagSafe والشحن اللاسلكي",
        "اتصال 5G وUSB‑C",
        "مقاومة الماء والغبار حسب معيار IP68",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أسود",
        "أبيض",
        "وردي"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-16-pro-max-256",
      "name": "iPhone 16 Pro Max — 256GB",
      "category": "آيفون",
      "price": 4699,
      "badge": "كاميرا Pro",
      "image": "https://www.teknikproffset.no/img/bilder/artiklar/zoom/C81510_1.jpg?m=1727144034",
      "shortDescription": "شاشة 6.9 بوصة وكاميرات Pro ومعالج A18 Pro.",
      "description": "هاتف Apple iPhone 16 Pro Max بسعة 256GB، يجمع بين شاشة Super Retina XDR OLED كبيرة مقاس 6.9 بوصة وشريحة A18 Pro ونظام كاميرات Pro متقدم. يوفر عدسة تقريب بصري 5x وتصويرًا عالي الجودة، مع هيكل من التيتانيوم.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.9 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A18 Pro",
        "الكاميرات الخلفية: 48MP Fusion و48MP Ultra Wide وعدسة Telephoto بدقة 12MP",
        "تقريب بصري 5x",
        "الكاميرا الأمامية: 12MP TrueDepth",
        "السعة المحددة: 256GB",
        "الألوان المتاحة: تيتانيوم أسود، تيتانيوم طبيعي، تيتانيوم أبيض، تيتانيوم صحراوي",
        "اتصال 5G وUSB‑C",
        "مقاومة الماء والغبار حسب معيار IP68",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "تيتانيوم أسود",
        "تيتانيوم طبيعي",
        "تيتانيوم أبيض",
        "تيتانيوم صحراوي"
      ],
      "storageOptions": [
        "256GB"
      ]
    },
    {
      "id": "iphone-16-pro-128",
      "name": "iPhone 16 Pro — 128GB",
      "category": "آيفون",
      "price": 3949,
      "badge": "حجم عملي",
      "image": "https://mtunda.ug/cdn/shop/files/iphone-16-pro.jpg?v=1727077527",
      "shortDescription": "أداء A18 Pro وكاميرات ثلاثية احترافية في حجم 6.3 بوصة.",
      "description": "هاتف Apple iPhone 16 Pro بسعة 128GB، يقدم إمكانات تصوير احترافية مع شريحة A18 Pro وشاشة Super Retina XDR OLED مقاس 6.3 بوصة بتقنية ProMotion. يأتي بهيكل تيتانيوم ونظام كاميرات ثلاثي متعدد الاستخدامات.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.3 بوصة مع ProMotion حتى 120Hz",
        "المعالج: Apple A18 Pro",
        "الكاميرات الخلفية: 48MP Fusion و48MP Ultra Wide وعدسة Telephoto بدقة 12MP",
        "تقريب بصري 5x",
        "الكاميرا الأمامية: 12MP TrueDepth",
        "السعة المحددة: 128GB",
        "الألوان المتاحة: تيتانيوم أسود، تيتانيوم طبيعي، تيتانيوم أبيض، تيتانيوم صحراوي",
        "اتصال 5G وUSB‑C",
        "مقاومة الماء والغبار حسب معيار IP68",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "تيتانيوم أسود",
        "تيتانيوم طبيعي",
        "تيتانيوم أبيض",
        "تيتانيوم صحراوي"
      ],
      "storageOptions": [
        "128GB"
      ]
    },
    {
      "id": "iphone-16e-128",
      "name": "iPhone 16e — 128GB",
      "category": "آيفون",
      "price": 2299,
      "badge": "سعر اقتصادي",
      "image": "https://assets.shpresa.al/shop/2025/03/e9f4adbb-cel2067-b-3.jpg",
      "shortDescription": "شريحة A18 وكاميرا 48MP وتجربة iPhone بسعر مناسب.",
      "description": "هاتف Apple iPhone 16e بسعة 128GB، يوفر أداءً سريعًا مع شريحة A18 وشاشة Super Retina XDR OLED مقاس 6.1 بوصة وكاميرا Fusion بدقة 48MP. مناسب للاستخدام اليومي والتطبيقات والتصوير الأساسي.",
      "specifications": [
        "الشاشة: Super Retina XDR OLED مقاس 6.1 بوصة",
        "المعالج: Apple A18",
        "الكاميرا الخلفية: 48MP Fusion",
        "الكاميرا الأمامية: 12MP TrueDepth",
        "السعة المحددة: 128GB",
        "الألوان المتاحة: أسود، أبيض",
        "اتصال 5G وUSB‑C",
        "مقاومة الماء والغبار حسب معيار IP68",
        "الضمان حسب سياسة المتجر"
      ],
      "colors": [
        "أسود",
        "أبيض"
      ],
      "storageOptions": [
        "128GB"
      ]
    }
];

export const defaultStoreProducts: Product[] = products.slice(-10);

export function formatPrice(value: number) {
  const amount = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(value);
  return amount + ' ر.س';
}

export function getProductPrice(product: Pick<Product, 'price' | 'storagePrices'>, storage?: string) {
  const optionPrice = storage ? product.storagePrices?.[storage] : undefined;
  return typeof optionPrice === 'number' && Number.isFinite(optionPrice) && optionPrice > 0
    ? optionPrice
    : product.price;
}

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}
