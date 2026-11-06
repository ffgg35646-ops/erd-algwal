import type { Product } from '@/lib/products';

export const sourceCatalogCategories = [
  { name: 'سلسلة آيفون 18 برو ماكس', icon: '', description: 'هواتف iPhone 18 Pro Max وخياراتها' },
  { name: 'سلسلة آيفون 18 برو', icon: '', description: 'هواتف iPhone 18 Pro وخياراتها' },
  { name: 'سلسلة آيفون 18 ديو', icon: '', description: 'هواتف iPhone Duo وخياراتها' },
  { name: 'سلسلة آيفون 17 برو ماكس', icon: '', description: 'هواتف iPhone 17 Pro Max' },
  { name: 'سلسلة آيفون 17 برو', icon: '', description: 'هواتف iPhone 17 Pro' },
  { name: 'سلسلة آيفون 17', icon: '', description: 'هواتف iPhone 17' },
  { name: 'سلسلة آيفون 17 Air', icon: '', description: 'هواتف iPhone Air' },
  { name: 'سلسلة آيفون 16', icon: '', description: 'هواتف سلسلة iPhone 16' },
  { name: 'سلسلة آيفون 16 برو', icon: '', description: 'هواتف iPhone 16 Pro' },
  { name: 'سلسلة آيفون 16 بلس', icon: '', description: 'هواتف iPhone 16 Plus' },
  { name: 'سلسلة آيفون 15', icon: '', description: 'هواتف سلسلة iPhone 15' },
  { name: 'سلسلة آيفون 15 بلس', icon: '', description: 'هواتف iPhone 15 Plus' },
  { name: 'سلسلة آيفون 14', icon: '', description: 'هواتف سلسلة iPhone 14' },
  { name: 'سلسلة آيفون 13', icon: '', description: 'هواتف سلسلة iPhone 13' },
  { name: 'سلسلة سامسونج ألترا', icon: '◈', description: 'هواتف Samsung Galaxy Ultra الأقدم' },
  { name: 'العاب بلايستيشن 5', icon: '🎮', description: 'أجهزة وألعاب منصات PlayStation وNintendo كما تظهر في كتالوج المصدر' },
  { name: 'العاب نينتندو سويتش', icon: '🎮', description: 'ألعاب Nintendo Switch' },
  { name: 'سامسونج S26', icon: '◈', description: 'هواتف Samsung Galaxy S26 وS26+ وS26 Ultra' },
  { name: 'سامسونج S25', icon: '◈', description: 'هواتف Samsung Galaxy S25 وS25+ وS25 Ultra' },
  { name: 'سامسونج S24', icon: '◈', description: 'هواتف Samsung Galaxy S24 Ultra' }
] as const;

const images = {
  iphone18: 'https://cdn2.blanxer.com/uploads/682feff88c633f25b4c7ce32/product_image-iphone-18-pro-max-0291.webp',
  iphone18Duo: 'https://q4.itc.cn/q_70/images03/20260919/40afa3639c26431b8d53ea21ab22f6c3.jpeg',
  iphone17ProMax: 'https://image.vandenborre.be/WEB/images/products/superzoom/apple_iphone-17-pmax-512gb-oran_7654170_1.jpg',
  iphone17Pro: 'https://www.pbtech.co.nz/imgprod/M/P/MPHAPP817212.jpg?h=3366490703',
  iphone17: 'https://doc.smarty.cz/pic/FPMH000K01-600-600.jpg',
  iphoneAir: 'https://www.3chub.com/cdn/shop/files/iPhone_Air_Sky_Blue_1024x1024.png?v=1760908654',
  iphone16ProMax: 'https://bbpcdn.pstatic.gr/bpimg44/2maNQ0/1SNW8Q_SX946Y946/1725956548/apple-iphone-16-pro-max-256gb.jpg',
  iphone16Pro: 'https://cdn.cimri.io/image/1200x1200/apple-iphone-16-pro-128gb_917069349.jpg',
  iphone15ProMax: 'https://cdn.vatanbilgisayar.com/Upload/PRODUCT/apple/thumb/141050-1-2_large.jpg',
  iphone15Pro: 'https://i5.walmartimages.com/asr/d6348e37-1d85-4bc4-bb28-fd073b237c65.a88d6a966b7b3cd3d029ab25538945f3.jpeg',
  iphone15Plus: 'https://maxmobiles.ru/images/thumbnails/2000/2000/detailed/67/1_vu8f-a2.jpg',
  iphone14: 'https://www.pbtech.co.nz/imgprod/M/P/MPHAPP814001.jpg?h=2939260435',
  iphone13: 'https://api.priceinkenya.com/media/124616/conversions/iphone13d-original.webp',
  iphone14ProMax: 'https://media.ldlc.com/r1600/ld/products/00/05/97/77/LD0005977700_0005977729_0005977763.jpg',
  iphone13ProMax: 'https://store.gorecell.ca/cdn/shop/files/fc29e37dc7da4925b6d68993054e63ab.jpg?v=1726081893',
  samsungS26: 'https://images.samsung.com/africa_fr/smartphones/galaxy-s26/buy/kv_group_PC_noText.jpg?imbypass=true',
  samsungS25: 'https://media.solotodo.com/media/products/2012218_picture_1790294146.jpg',
  samsungS24: 'https://becextech.com.au/media/catalog/product/cache/87bf6cc783e51bde4c0e5a7b582a0719/N/B/NBXTGalS24UltVar_1_3.jpg',
  samsungS21: 'https://i5.walmartimages.com/seo/Samsung-Galaxy-S21-5G-6-2-inch-SM-G991U-Unlocked-128GB-Phantom-Violet-Used_0dd3bcfa-4808-4ba8-9ad5-a2e34e12d48f.e5941573e3dcaa007adaa18dbc0cd0e1.jpeg',
  samsungS22: 'https://www.jyes.com.tw/data/goods/gallery/202202/1644894098842193033.jpg',
  samsungS23: 'https://www.phoneu.ca/cdn/shop/products/10_4000_416f46a2-5d6e-4699-a0f4-63df39e3d7d9.jpg?v=1682658873&width=1445',
  playstation: 'https://store.sony.co.nz/dw/image/v2/ABBC_PRD/on/demandware.static/-/Sites-sony-master-catalog/default/dw1b537bbb/images/PLAYSTATION5W/PLAYSTATION5W.png',
  nintendo: 'https://switch-cn.gtgres.com/global-image/fee172f0-6a18-11ec-abbd-e1aeab85f975.jpg',
  tonyHawk: 'https://www.gamekings.co.uk/cdn/shop/files/71fEahS3YUL._AC_SL1500.jpg?v=1690827360&width=1200',
  lifeStrange: 'https://product.hstatic.net/200000160361/product/z4335899793326_f436c8abb2499725fbf3e16cdae59c91_ae9fedef08d642a7b6859b00e1a19d4d_grande.jpg',
  rocketLeague: 'https://cdn.mobygames.com/99d57500-ab80-11ed-b6ec-02420a00019b.webp',
  shinMegami: 'https://product.hstatic.net/1000154920/product/shin_megami_tensei_v_92a3b137d86f46699a0d970b291d3d0f_grande.png',
  crash: 'https://assets.products-live.ao.com/Images/7f716b9d-43bd-4805-a16e-496179ed9f63/1280x1280/NSKEADACT29417_nintendo_games_01.jpg',
  switch12: 'https://elektra.vtexassets.com/arquivos/ids/19440983/71-Sz-S-Wic4-L.jpg?v=638980049806600000'
};

const items: Product[] = [];

function add(
  id: string,
  name: string,
  category: string,
  price: number,
  image: string,
  shortDescription: string,
  description: string,
  specifications: string[] = [],
  options: Partial<Pick<Product, 'oldPrice' | 'badge' | 'colors' | 'storageOptions' | 'storagePrices'>> = {}
) {
  items.push({
    id,
    name,
    category,
    price,
    image,
    shortDescription,
    description,
    specifications,
    ...options
  });
}

// Apple iPhone 18
add('qauara-iphone-18-pro-max', 'آيفون 18 برو ماكس', 'سلسلة آيفون 18 برو ماكس', 5799, images.iphone18,
  'شاشة كبيرة وأداء Pro وكاميرات متقدمة.',
  'هاتف iPhone 18 Pro Max بشاشة Super Retina XDR مقاس 6.9 بوصة، وشريحة A20 Pro، ونظام كاميرات Pro Fusion بدقة 48MP. تظهر خيارات الألوان والسعات بحسب المتاح في المتجر.',
  ['شاشة Super Retina XDR OLED مقاس 6.9 بوصة', 'شريحة Apple A20 Pro', 'نظام كاميرات Pro Fusion بدقة 48MP', 'ألوان المصدر: أسود، فضي، جليدي، عنابي'],
  { colors: ['أسود', 'فضي', 'جليدي', 'عنابي'], storageOptions: ['256GB'] });

add('qauara-iphone-18-pro', 'آيفون 18 برو', 'سلسلة آيفون 18 برو', 5699, images.iphone18,
  'حجم عملي مع أداء Pro وتصوير متقدم.',
  'هاتف iPhone 18 Pro بشاشة Super Retina XDR OLED مقاس 6.3 بوصة، وشريحة A20 Pro، ونظام كاميرات Pro Fusion بدقة 48MP. تظهر خيارات الألوان والسعات بحسب المتاح في المتجر.',
  ['شاشة Super Retina XDR OLED مقاس 6.3 بوصة', 'شريحة Apple A20 Pro', 'كاميرا رئيسية Fusion بدقة 48MP', 'ألوان المصدر: أسود، فضي، جليدي، عنابي'],
  { colors: ['أسود', 'فضي', 'جليدي', 'عنابي'], storageOptions: ['256GB'] });

add('qauara-iphone-18-duo', 'آيفون 18 ديو', 'سلسلة آيفون 18 ديو', 9499, images.iphone18Duo,
  'إصدار Duo بخيارين لونيين كما يعرضهما المتجر.',
  'إصدار iPhone 18 Duo المعروض في كتالوج المصدر بخياري أبيض النجوم وسماء الليل. يُرجى مراجعة تفاصيل السعة والتوافق قبل اعتماد المنتج للبيع.',
  ['خيارات المصدر: أبيض النجوم، سماء الليل'],
  { colors: ['أبيض النجوم', 'سماء الليل'] });

// iPhone 17
add('qauara-iphone-17-pro-max', 'آيفون 17 برو ماكس', 'سلسلة آيفون 17 برو ماكس', 4499, images.iphone17ProMax,
  'شاشة واسعة وكاميرات Pro وأداء قوي.',
  'هاتف iPhone 17 Pro Max بشاشة Super Retina XDR مقاس 6.9 بوصة، وشريحة A19 Pro، ونظام كاميرات Pro Fusion متعدد الاستخدامات. السعر مأخوذ من قائمة المصدر.',
  ['شاشة Super Retina XDR مقاس 6.9 بوصة', 'شريحة Apple A19 Pro', 'نظام كاميرات Pro Fusion', 'اتصال USB‑C و5G']);

add('qauara-iphone-17-pro', 'آيفون 17 برو', 'سلسلة آيفون 17 برو', 3990, images.iphone17Pro,
  'تصوير احترافي وأداء سريع في حجم 6.3 بوصة.',
  'هاتف iPhone 17 Pro بشاشة Super Retina XDR مقاس 6.3 بوصة، وشريحة A19 Pro، ونظام كاميرات Pro Fusion للتصوير اليومي وصناعة المحتوى.',
  ['شاشة Super Retina XDR مقاس 6.3 بوصة', 'شريحة Apple A19 Pro', 'نظام كاميرات Pro Fusion', 'مقاومة الماء والغبار وفق معيار IP68']);

add('qauara-iphone-17', 'آيفون 17', 'سلسلة آيفون 17', 3300, images.iphone17,
  'شاشة 6.3 بوصة وكاميرات Fusion مزدوجة.',
  'هاتف iPhone 17 بشاشة Super Retina XDR مقاس 6.3 بوصة، وشريحة A19، وكاميرا Fusion مزدوجة بدقة 48MP. يجمع بين الأداء اليومي والتصوير الواضح.',
  ['شاشة Super Retina XDR مقاس 6.3 بوصة', 'شريحة Apple A19', 'كاميرا Fusion مزدوجة بدقة 48MP', 'ألوان iPhone 17 الرسمية متعددة']);

add('qauara-iphone-17-air', 'آيفون Air', 'سلسلة آيفون 17 Air', 3400, images.iphoneAir,
  'تصميم فائق النحافة مع شاشة 6.5 بوصة.',
  'هاتف iPhone Air بتصميم نحيف وخفيف، وشاشة Super Retina XDR مقاس 6.5 بوصة، وشريحة A19 Pro، وكاميرا Fusion بدقة 48MP.',
  ['شاشة Super Retina XDR مقاس 6.5 بوصة', 'شريحة Apple A19 Pro', 'كاميرا Fusion بدقة 48MP', 'السماكة 5.64 مم تقريبًا']);

// iPhone 16
add('qauara-iphone-16-pro-max', 'آيفون 16 برو ماكس', 'سلسلة آيفون 16', 3800, images.iphone16ProMax,
  'شاشة 6.9 بوصة وشريحة A18 Pro وكاميرات احترافية.',
  'هاتف iPhone 16 Pro Max بشاشة Super Retina XDR OLED مقاس 6.9 بوصة، وشريحة A18 Pro، ونظام كاميرات Pro متقدم مع تقريب بصري وتصوير فيديو عالي الجودة.',
  ['شاشة OLED مقاس 6.9 بوصة مع ProMotion', 'شريحة Apple A18 Pro', 'كاميرا رئيسية Fusion بدقة 48MP', 'هيكل تيتانيوم']);

add('qauara-iphone-16-pro', 'آيفون 16 برو', 'سلسلة آيفون 16 برو', 3200, images.iphone16Pro,
  'شاشة 6.3 بوصة وأداء A18 Pro.',
  'هاتف iPhone 16 Pro بشاشة Super Retina XDR OLED مقاس 6.3 بوصة، وشريحة A18 Pro، ونظام كاميرات Pro ثلاثي يتيح التصوير الواسع والتقريب.',
  ['شاشة OLED مقاس 6.3 بوصة مع ProMotion', 'شريحة Apple A18 Pro', 'نظام كاميرات Pro ثلاثي', 'هيكل تيتانيوم']);

add('qauara-iphone-16-plus', 'آيفون 16 بلس', 'سلسلة آيفون 16 بلس', 3300, images.iphone16ProMax,
  'شاشة كبيرة وبطارية للاستخدام اليومي.',
  'هاتف iPhone 16 Plus بشاشة Super Retina XDR كبيرة، وشريحة A18، وكاميرا Fusion مزدوجة. خيارات السعة والأسعار المتاحة تظهر في قائمة المنتج.',
  ['شاشة Super Retina XDR كبيرة', 'شريحة Apple A18', 'كاميرا Fusion مزدوجة', 'اتصال USB‑C']);
add('qauara-iphone-16-plus-alt-price', 'آيفون 16 بلس', 'سلسلة آيفون 16 بلس', 3800, images.iphone16ProMax,
  'شاشة كبيرة وبطارية للاستخدام اليومي.',
  'هاتف iPhone 16 Plus بشاشة Super Retina XDR كبيرة، وشريحة A18، وكاميرا Fusion مزدوجة. يعرض المصدر هذا السعر في إدراج منفصل للمنتج.',
  ['شاشة Super Retina XDR كبيرة', 'شريحة Apple A18', 'كاميرا Fusion مزدوجة', 'اتصال USB‑C']);

// iPhone 15
const iphone15Rows = [
  ['iphone-15-pro-128', 'آيفون 15 برو 128 جيجابايت', 2908],
  ['iphone-15-pro-256', 'آيفون 15 برو 256 جيجابايت', 3608],
  ['iphone-15-pro-max-256', 'آيفون 15 برو ماكس 256 جيجابايت', 3699],
  ['iphone-15-pro-max-512', 'آيفون 15 برو ماكس 512 جيجابايت', 4300],
  ['iphone-15-pro-1tb', 'آيفون 15 برو 1 تيرابايت', 4900],
  ['iphone-15-pro-max-1tb', 'آيفون 15 برو ماكس 1 تيرابايت', 5299]
] as const;
for (const [id, name, price] of iphone15Rows) {
  add('qauara-' + id, name, 'سلسلة آيفون 15', price, images.iphone15Pro,
    'نسخة iPhone 15 Pro بسعة التخزين المحددة في اسم المنتج.',
    'هاتف iPhone 15 Pro أو Pro Max بهيكل تيتانيوم وشاشة Super Retina XDR ونظام كاميرات Pro. السعة التخزينية والسعر مطابقان للعنصر المعروض في قائمة المصدر.',
    ['شاشة Super Retina XDR مع ProMotion', 'شريحة Apple A17 Pro', 'نظام كاميرات Pro', 'منفذ USB‑C']);
}

const iphone15PlusRows = [
  ['128', 3300], ['256', 3500], ['512', 4799]
] as const;
for (const [storage, price] of iphone15PlusRows) {
  add('qauara-iphone-15-plus-' + storage, 'آيفون 15 بلس ' + storage + ' جيجابايت', 'سلسلة آيفون 15 بلس', price, images.iphone15Plus,
    'نسخة iPhone 15 Plus بسعة ' + storage + ' جيجابايت.',
    'هاتف iPhone 15 Plus بشاشة Super Retina XDR كبيرة وشريحة A16 Bionic وكاميرا رئيسية 48MP. السعة والسعر مطابقان لقائمة المصدر.',
    ['شاشة Super Retina XDR', 'شريحة Apple A16 Bionic', 'كاميرا رئيسية 48MP', 'منفذ USB‑C']);
}

// iPhone 14
const iphone14Rows = [
  ['plus-128', 'آيفون 14 بلس 128 جيجابايت', 2500],
  ['base-128', 'آيفون 14 128 جيجابايت', 2899],
  ['plus-256', 'آيفون 14 بلس 256 جيجابايت', 2900],
  ['pro-max-128', 'آيفون 14 برو ماكس 128 جيجابايت', 3100],
  ['base-256', 'آيفون 14 256 جيجابايت', 3299],
  ['pro-256', 'آيفون 14 برو 256 جيجابايت', 3799],
  ['pro-max-256', 'آيفون 14 برو ماكس 256 جيجابايت', 3800],
  ['plus-512', 'آيفون 14 بلس 512 جيجابايت', 3800],
  ['base-512', 'آيفون 14 512 جيجابايت', 4299],
  ['pro-512', 'آيفون 14 برو 512 جيجابايت', 4400]
] as const;
for (const [id, name, price] of iphone14Rows) {
  add('qauara-iphone-14-' + id, name, 'سلسلة آيفون 14', price, images.iphone14,
    'نسخة iPhone 14 بسعة التخزين المحددة في اسم المنتج.',
    'هاتف iPhone 14 من الجيل الرابع عشر، بشاشة Super Retina XDR وكاميرات متقدمة واتصال 5G. السعة والسعر مطابقان للعنصر المعروض في قائمة المصدر.',
    ['شاشة Super Retina XDR', 'اتصال 5G', 'كاميرات متعددة الاستخدامات', 'دعم MagSafe']);
}

// iPhone 13
const iphone13Rows = [
  ['base-128', 'آيفون 13 128 جيجابايت', 1950],
  ['base-256', 'آيفون 13 256 جيجابايت', 2150],
  ['pro-256', 'آيفون 13 برو 256 جيجابايت', 2699],
  ['pro-max-128', 'آيفون 13 برو ماكس 128 جيجابايت', 2699],
  ['pro-max-256', 'آيفون 13 برو ماكس 256 جيجابايت', 2999],
  ['pro-max-512', 'آيفون 13 برو ماكس 512 جيجابايت', 3699]
] as const;
for (const [id, name, price] of iphone13Rows) {
  const image = id.includes('pro') ? images.iphone13ProMax : images.iphone13;
  add('qauara-iphone-13-' + id, name, 'سلسلة آيفون 13', price, image,
    'نسخة iPhone 13 بسعة التخزين المحددة في اسم المنتج.',
    'هاتف iPhone 13 بشاشة Super Retina XDR وشريحة A15 Bionic واتصال 5G. إصدارات Pro تضيف شاشة ProMotion ونظام كاميرات Pro. السعة والسعر مطابقان لقائمة المصدر.',
    ['شاشة Super Retina XDR', 'شريحة Apple A15 Bionic', 'اتصال 5G', 'كاميرات متقدمة']);
}

// Samsung Ultra older models
add('qauara-galaxy-s21', 'سامسونج هاتف جالاكسي S21', 'سلسلة سامسونج ألترا', 2800, images.samsungS21,
  'هاتف من سلسلة Galaxy S21.',
  'هاتف Samsung Galaxy S21 من الفئة الرائدة، بشاشة AMOLED وأداء سريع وكاميرات متعددة. السعر مطابق لقائمة المصدر.',
  ['شاشة Dynamic AMOLED 2X', 'اتصال 5G', 'كاميرات متعددة', 'نظام Android']);
add('qauara-galaxy-s22', 'سامسونج هاتف جالاكسي S22', 'سلسلة سامسونج ألترا', 3300, images.samsungS22,
  'هاتف من سلسلة Galaxy S22.',
  'هاتف Samsung Galaxy S22 بتصميم مدمج وشاشة Dynamic AMOLED 2X وأداء رائد وكاميرات متقدمة. السعر مطابق لقائمة المصدر.',
  ['شاشة Dynamic AMOLED 2X', 'اتصال 5G', 'كاميرات متعددة', 'نظام Android']);
add('qauara-galaxy-s23', 'سامسونج هاتف جالاكسي S23', 'سلسلة سامسونج ألترا', 3500, images.samsungS23,
  'هاتف من سلسلة Galaxy S23.',
  'هاتف Samsung Galaxy S23 بأداء قوي وشاشة Dynamic AMOLED 2X وكاميرات عالية الدقة. السعر مطابق لقائمة المصدر.',
  ['شاشة Dynamic AMOLED 2X', 'معالج Snapdragon for Galaxy', 'اتصال 5G', 'كاميرات متعددة']);

// Consoles listed in the PlayStation section on the source store
add('qauara-switch-extended-battery', 'جهاز نينتندو سويتش نسخة ممتدة البطارية (أحمر أزرق)', 'العاب بلايستيشن 5', 1259, images.nintendo,
  'جهاز Nintendo Switch المحمول والهجين.',
  'جهاز Nintendo Switch بنسخة البطارية الممتدة وأداتي تحكم باللونين الأحمر والأزرق، للاستخدام المحمول أو على شاشة التلفزيون.',
  ['وضع محمول ووضع تلفزيون', 'أدوات تحكم Joy‑Con', 'بطارية ممتدة']);
add('qauara-switch-oled-white', 'جهاز نينتندو سويتش OLED أبيض', 'العاب بلايستيشن 5', 1520, images.nintendo,
  'نسخة Nintendo Switch OLED باللون الأبيض.',
  'جهاز Nintendo Switch OLED بشاشة OLED مقاس 7 بوصات وقاعدة توصيل وأدوات تحكم Joy‑Con بيضاء.',
  ['شاشة OLED مقاس 7 بوصات', 'وضع محمول ووضع تلفزيون', 'قاعدة توصيل وأدوات Joy‑Con']);
add('qauara-ps5-digital', 'بلايستيشن 5 نسخة ديجيتال', 'العاب بلايستيشن 5', 1899, images.playstation,
  'جهاز PlayStation 5 إصدار رقمي.',
  'جهاز PlayStation 5 Digital Edition لتشغيل الألعاب الرقمية، مع أداء رسومي متقدم ووحدة تحكم DualSense.',
  ['إصدار رقمي بدون قارئ أقراص', 'وحدة تحكم DualSense', 'دعم ألعاب PS5']);
add('qauara-ps5-disc', 'جهاز بلايستيشن 5 نسخة أقراص', 'العاب بلايستيشن 5', 2125, images.playstation,
  'جهاز PlayStation 5 مع قارئ أقراص.',
  'جهاز PlayStation 5 بإصدار قارئ الأقراص لتشغيل الألعاب الرقمية والنسخ الفيزيائية المتوافقة.',
  ['قارئ أقراص', 'وحدة تحكم DualSense', 'دعم ألعاب PS5']);
add('qauara-ps5-extra-controller', 'بلايستيشن 5 نسخة أقراص مع وحدة تحكم إضافية', 'العاب بلايستيشن 5', 2299, images.playstation,
  'حزمة جهاز PS5 مع وحدة تحكم إضافية.',
  'حزمة PlayStation 5 بإصدار الأقراص مع وحدة تحكم DualSense إضافية للعب الجماعي.',
  ['جهاز PS5 بقارئ أقراص', 'وحدتا تحكم DualSense']);
add('qauara-ps5-gt7-bundle', 'بلايستيشن 5 نسخة أقراص مع وحدة تحكم إضافية ولعبة GT7', 'العاب بلايستيشن 5', 2550, images.playstation,
  'حزمة PS5 مع يد إضافية ولعبة GT7.',
  'حزمة PlayStation 5 بإصدار الأقراص، ووحدة تحكم إضافية، ولعبة Gran Turismo 7.',
  ['جهاز PS5 بقارئ أقراص', 'وحدتا تحكم DualSense', 'لعبة Gran Turismo 7']);

// Nintendo Switch games
add('qauara-game-tony-hawk', 'Tony Hawk Pro Skater 1 and 2', 'العاب نينتندو سويتش', 120, images.tonyHawk,
  'مجموعة ألعاب تزلج Tony Hawk.',
  'مجموعة Tony Hawk’s Pro Skater 1 + 2 تعيد تقديم أول لعبتين من السلسلة برسومات محسنة ومراحل ومتزلجين وحركات كلاسيكية.',
  ['منصة Nintendo Switch', 'ألعاب رياضية وحركة', 'تجربة فردية وتنافسية']);
add('qauara-game-life-is-strange', 'Life is Strange', 'العاب نينتندو سويتش', 160, images.lifeStrange,
  'مغامرة قصصية تعتمد على الاختيارات.',
  'لعبة Life is Strange تجربة مغامرات قصصية تركز على الشخصيات والقرارات وتأثيرها في مجرى القصة. الاسم والسعر من قائمة المصدر.',
  ['منصة Nintendo Switch', 'مغامرة قصصية', 'قرارات تؤثر في الأحداث']);
add('qauara-game-rocket-league', 'Rocket League Collector’s Edition - Nintendo Switch', 'العاب نينتندو سويتش', 180, images.rocketLeague,
  'كرة قدم سريعة باستخدام السيارات.',
  'Rocket League تجمع بين قيادة السيارات وكرة القدم في مباريات سريعة تعتمد على المهارة والتعاون والتنافس.',
  ['منصة Nintendo Switch', 'رياضة وأكشن', 'مباريات تنافسية']);
add('qauara-game-shin-megami-tensei-v', 'Shin Megami Tensei V', 'العاب نينتندو سويتش', 189, images.shinMegami,
  'لعبة تقمص أدوار واستكشاف.',
  'Shin Megami Tensei V لعبة تقمص أدوار يواجه فيها اللاعب الشياطين ويستكشف عالماً واسعاً ويخوض معارك تعتمد على التخطيط.',
  ['منصة Nintendo Switch', 'لعبة تقمص أدوار', 'قتال واستكشاف']);
add('qauara-game-crash-bandicoot-4', 'Crash Bandicoot 4', 'العاب نينتندو سويتش', 189, images.crash,
  'مغامرة ومنصات مع شخصية Crash.',
  'Crash Bandicoot 4: It’s About Time لعبة منصات ومغامرات مليئة بالمراحل والتحديات والأقنعة ذات القدرات الخاصة.',
  ['منصة Nintendo Switch', 'لعبة منصات ومغامرات', 'تحديات ومراحل متنوعة']);
add('qauara-game-1-2-switch', '1-2-Switch', 'العاب نينتندو سويتش', 189, images.switch12,
  'مجموعة ألعاب جماعية قصيرة باستخدام Joy‑Con.',
  '1-2-Switch مجموعة ألعاب مصغرة تعتمد على أدوات Joy‑Con والتفاعل المباشر بين اللاعبين.',
  ['منصة Nintendo Switch', 'ألعاب جماعية', 'استخدام أدوات Joy‑Con']);

// Samsung Galaxy S26
add('qauara-galaxy-s26', 'سامسونج جالكسي S26', 'سامسونج S26', 3499, images.samsungS26,
  'هاتف Galaxy S26 بخيارات سعة وألوان متعددة.',
  'هاتف Samsung Galaxy S26 بشاشة Dynamic AMOLED وأداء رائد وكاميرات متعددة. تتوفر خيارات اللون والسعة وفق قائمة المصدر.',
  ['شاشة Dynamic AMOLED', 'اتصال 5G', 'خيارات تخزين 256GB و512GB', 'ألوان المصدر متعددة'],
  { colors: ['ذهبي وردي', 'فضي داكن', 'أبيض', 'أسود', 'أزرق سماوي', 'بنفسجي غامق'], storageOptions: ['256GB', '512GB'], storagePrices: { '512GB': 4599 } });
add('qauara-galaxy-s26-plus', 'سامسونج جالكسي S26 Plus', 'سامسونج S26', 3999, images.samsungS26,
  'هاتف Galaxy S26 Plus بشاشة أكبر وخيارات تخزين متعددة.',
  'هاتف Samsung Galaxy S26 Plus بشاشة Dynamic AMOLED كبيرة وأداء رائد وكاميرات متعددة. تتوفر خيارات اللون والسعة وفق قائمة المصدر.',
  ['شاشة Dynamic AMOLED كبيرة', 'اتصال 5G', 'خيارات تخزين 256GB و512GB'],
  { colors: ['ذهبي وردي', 'فضي داكن', 'أبيض', 'أسود', 'أزرق سماوي', 'بنفسجي غامق'], storageOptions: ['256GB', '512GB'], storagePrices: { '512GB': 4799 } });
add('qauara-galaxy-s26-ultra', 'سامسونج جالكسي S26 Ultra', 'سامسونج S26', 5899, images.samsungS26,
  'فئة Ultra مع قلم S Pen وسعات تخزين متعددة.',
  'هاتف Samsung Galaxy S26 Ultra بشاشة Dynamic AMOLED 2X كبيرة ونظام كاميرات متقدم ودعم قلم S Pen. خيارات السعة والأسعار كما تظهر في المصدر.',
  ['شاشة Dynamic AMOLED 2X مقاس 6.9 بوصة', 'قلم S Pen', 'نظام كاميرات بدقة عالية', 'خيارات 256GB و512GB و1TB'],
  { colors: ['ذهبي وردي', 'فضي داكن', 'أبيض', 'أسود', 'أزرق سماوي', 'بنفسجي غامق'], storageOptions: ['256GB', '512GB', '1TB'], storagePrices: { '512GB': 6699, '1TB': 8299 } });

// Samsung Galaxy S25
add('qauara-galaxy-s25', 'سامسونج جالكسي S25', 'سامسونج S25', 2199, images.samsungS25,
  'هاتف Galaxy S25 بثلاث سعات تخزين.',
  'هاتف Samsung Galaxy S25 بشاشة Dynamic AMOLED 2X وشريحة Snapdragon for Galaxy وكاميرات متعددة. السعات والأسعار مطابقة لقائمة المصدر.',
  ['شاشة Dynamic AMOLED 2X', 'معالج Snapdragon for Galaxy', 'خيارات 128GB و256GB و512GB'],
  { colors: ['ذهبي وردي', 'أحمر مرجاني', 'أزرق داكن', 'كحلي', 'نعناعي', 'فضي', 'أزرق ثلجي'], storageOptions: ['128GB', '256GB', '512GB'], storagePrices: { '256GB': 2299, '512GB': 2899 } });
add('qauara-galaxy-s25-plus', 'سامسونج جالكسي S25 Plus', 'سامسونج S25', 2799, images.samsungS25,
  'هاتف Galaxy S25 Plus بشاشة أكبر وسعتين.',
  'هاتف Samsung Galaxy S25 Plus بشاشة Dynamic AMOLED 2X كبيرة وأداء رائد وكاميرات متعددة. السعات والأسعار مطابقة لقائمة المصدر.',
  ['شاشة Dynamic AMOLED 2X كبيرة', 'معالج Snapdragon for Galaxy', 'خيارات 256GB و512GB'],
  { colors: ['ذهبي وردي', 'أحمر مرجاني', 'أزرق داكن', 'كحلي', 'نعناعي', 'فضي', 'أزرق ثلجي'], storageOptions: ['256GB', '512GB'], storagePrices: { '512GB': 3299 } });
add('qauara-galaxy-s25-ultra', 'سامسونج جالكسي S25 Ultra', 'سامسونج S25', 3499, images.samsungS25,
  'فئة Ultra مع قلم S Pen وكاميرا رئيسية 200MP.',
  'هاتف Samsung Galaxy S25 Ultra بشاشة Dynamic AMOLED 2X مقاس 6.9 بوصة، وقلم S Pen، ونظام كاميرات يتضمن كاميرا رئيسية 200MP. السعات والأسعار مطابقة لقائمة المصدر.',
  ['شاشة Dynamic AMOLED 2X مقاس 6.9 بوصة', 'كاميرا رئيسية 200MP', 'قلم S Pen', 'خيارات 256GB و512GB و1TB'],
  { colors: ['تيتانيوم ذهبي وردي', 'تيتانيوم أخضر', 'تيتانيوم أسود داكن', 'تيتانيوم أسود', 'تيتانيوم أبيض فضي', 'تيتانيوم رمادي', 'تيتانيوم أزرق فضي'], storageOptions: ['256GB', '512GB', '1TB'], storagePrices: { '512GB': 3799, '1TB': 5299 } });

// Samsung Galaxy S24
add('qauara-galaxy-s24-ultra', 'سامسونج جالكسي S24 Ultra', 'سامسونج S24', 5399, images.samsungS24,
  'هاتف Galaxy S24 Ultra مع قلم S Pen وسعات متعددة.',
  'هاتف Samsung Galaxy S24 Ultra بشاشة Dynamic AMOLED 2X مقاس 6.8 بوصة، وقلم S Pen، وكاميرات متعددة مع تقريب بصري. السعات والأسعار مطابقة لقائمة المصدر.',
  ['شاشة Dynamic AMOLED 2X مقاس 6.8 بوصة', 'قلم S Pen', 'كاميرا رئيسية 200MP', 'خيارات 256GB و512GB و1TB'],
  { colors: ['تيتانيوم بنفسجي', 'تيتانيوم أخضر', 'تيتانيوم أسود', 'تيتانيوم أصفر', 'تيتانيوم رمادي'], storageOptions: ['256GB', '512GB', '1TB'], storagePrices: { '512GB': 5899, '1TB': 6899 } });

// The source lists these colours and storage capacities as separate product cards.
// Expand only the combinations explicitly shown in the source catalogue so every
// card can be independently edited or removed from the admin catalogue.
const colourCardProducts = new Set([
  'qauara-iphone-18-pro-max',
  'qauara-iphone-18-pro',
  'qauara-iphone-18-duo'
]);

function variantSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    Array.from(value).map((character) => character.codePointAt(0)?.toString(16) || '').join('-');
}

export const sourceCatalogProducts: Product[] = items.flatMap((product) => {
  if (colourCardProducts.has(product.id)) {
    const { colors, storageOptions: _storageOptions, storagePrices: _storagePrices, ...base } = product;
    return (colors || []).map((color) => ({
      ...base,
      id: product.id + '-' + variantSlug(color),
      name: product.name + ' - ' + color,
      specifications: [...product.specifications, 'اللون: ' + color]
    }));
  }

  if (product.id.startsWith('qauara-galaxy-s26') ||
      product.id.startsWith('qauara-galaxy-s25') ||
      product.id === 'qauara-galaxy-s24-ultra') {
    const { colors, storageOptions, storagePrices, ...base } = product;
    const capacities = storageOptions || [];
    const availableColors = colors || [];
    return capacities.flatMap((storage) => {
      const capacityColors = product.id === 'qauara-galaxy-s26-ultra' && storage === '1TB'
        ? availableColors.filter((color) => color !== 'ذهبي وردي')
        : availableColors;
      const price = storagePrices?.[storage] ?? product.price;
      return capacityColors.map((color) => ({
        ...base,
        id: product.id + '-' + variantSlug(storage) + '-' + variantSlug(color),
        name: product.name + ' ' + storage + ' - ' + color,
        price,
        specifications: [...product.specifications, 'السعة: ' + storage, 'اللون: ' + color]
      }));
    });
  }

  return [product];
});
