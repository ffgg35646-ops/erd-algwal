import type { Db } from 'mongodb';

export type StoreBanner = {
  id: string;
  imageUrl: string;
  alt: string;
};

function isHttpsImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The storefront must render the images saved by Telegram administration.
 * System-seeded Unsplash banners are deliberately excluded: they used to be
 * inserted ahead of admin uploads and made the site appear to ignore edits.
 */
export async function listStoreBanners(db: Db): Promise<StoreBanner[]> {
  const banners = await db.collection('store_banners')
    .find({ createdBySystem: { $ne: true } })
    .sort({ createdAt: 1, _id: 1 })
    .limit(12)
    .toArray();

  return banners.map((banner) => {
    const rawVersion = banner.updatedAt ?? banner.createdAt;
    const parsedVersion = rawVersion instanceof Date
      ? rawVersion.getTime()
      : typeof rawVersion === 'string'
        ? Date.parse(rawVersion)
        : 0;
    const version = Number.isFinite(parsedVersion) ? parsedVersion : 0;
    const id = String(banner._id);

    return {
      id,
      imageUrl: isHttpsImageUrl(banner.imageUrl)
        ? banner.imageUrl
        : '/api/store-banners/' + id + '/image?v=' + version,
      alt: typeof banner.alt === 'string' && banner.alt.trim()
        ? banner.alt
        : 'عرض من أرض الجوال'
    };
  });
}
