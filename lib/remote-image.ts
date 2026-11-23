import { isIP } from 'node:net';
import { NextResponse } from 'next/server';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function isPrivateAddress(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  const version = isIP(host);
  if (version === 4) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168);
  }
  if (version === 6) {
    return host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd')
      || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb');
  }
  return false;
}

function validateRemoteImageUrl(value: string) {
  const url = new URL(value);
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password || isPrivateAddress(url.hostname)) {
    throw new Error('Unsupported image URL');
  }
  return url;
}

export async function fetchRemoteImage(value: string) {
  try {
    let url = validateRemoteImageUrl(value);
    let response: Response | null = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(url, {
        redirect: 'manual',
        cache: 'force-cache',
        next: { revalidate: 3600 },
        headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8', 'user-agent': 'Mozilla/5.0 (compatible; ProductImageProxy/1.0)' },
        signal: AbortSignal.timeout(12000)
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (!location || attempt === 3) return new NextResponse('Image redirect could not be followed', { status: 502 });
        url = validateRemoteImageUrl(new URL(location, url).toString());
        continue;
      }
      break;
    }

    if (!response?.ok || !response.body) return new NextResponse('External image is unavailable', { status: 502 });
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(contentType)) {
      return new NextResponse('External resource is not a supported image', { status: 415 });
    }

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES) return new NextResponse('Image is too large', { status: 413 });

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return new NextResponse('Image is too large', { status: 413 });
      }
      chunks.push(chunk);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (!total) return new NextResponse('External image is empty', { status: 502 });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-length': String(total),
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('External product image proxy failed:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Unable to load external image', { status: 502 });
  }
}
