import OpenAI from 'openai';
import {
  decodeMaskToRaster,
  parseImageStream,
  recordsOfKind,
} from '@meta-sam/parser';
import { telegramApi } from '@/lib/telegram';
import type { ProductColorMask } from '@/lib/products';

type TelegramFile = { file_path?: string };



/**
 * Only case/cover products get a recoloring mask. This prevents the AI mask
 * from being applied to phones, chargers, headphones, or unrelated products.
 */
export function isPhoneCaseProduct(name: string, category: string, details = '') {
  const searchable = `${name} ${category} ${details}`.toLocaleLowerCase('ar');
  return /جراب|جرابات|كفر|كفرات|phone\s*case|case\s*cover|phone\s*cover|\bcase\b|\bcover\b/.test(searchable);
}

/**
 * Downloads the first Telegram product photo, asks SAM 3.1 for the phone-case
 * region, and stores only its compact binary mask. The original photo remains
 * the one and only product image; the browser performs recoloring from this mask.
 */
export async function generatePhoneCaseColorMask(
  telegramFileId: string,
  sourceColor: string
): Promise<ProductColorMask> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) {
    throw new Error('MODEL_API_KEY is not configured');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  const telegramFile = await telegramApi<TelegramFile>('getFile', { file_id: telegramFileId });
  if (!telegramFile.file_path) {
    throw new Error('Telegram did not return a path for the product image');
  }

  const imageResponse = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${telegramFile.file_path}`,
    { cache: 'no-store', signal: AbortSignal.timeout(12_000) }
  );
  if (!imageResponse.ok) {
    throw new Error(`Could not download the Telegram product image: ${imageResponse.status}`);
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('The first product file is not an image');
  }

  const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
  if (!imageBytes.length || imageBytes.length > 12 * 1024 * 1024) {
    throw new Error('The product image is empty or larger than 12 MB');
  }

  const client = new OpenAI({
    baseURL: 'https://api.meta.ai/v1',
    apiKey,
    timeout: 35_000,
    maxRetries: 0
  });

  const stream = await client.responses.create({
    model: 'sam-3.1',
    stream: true,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: 'phone case' },
          {
            type: 'input_image',
            image_url: `data:${contentType};base64,${imageBytes.toString('base64')}`
          }
        ]
      }
    ] as never,
    metadata: { mask_encoding: 'one_bit' }
  });

  const result = await parseImageStream(stream).finalResult;
  if (result.outcome.status !== 'completed') {
    throw new Error('The phone-case segmentation was incomplete');
  }

  const parserErrors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (parserErrors.length) {
    throw new Error('The segmentation service returned an invalid mask');
  }

  const candidates = recordsOfKind(result.records, 'mask')
    .map((record) => {
      const raster = decodeMaskToRaster(record.mask);
      let foregroundPixels = 0;
      for (const pixel of raster) foregroundPixels += pixel;
      return { record, raster, foregroundPixels };
    })
    .filter((candidate) => candidate.foregroundPixels > 0)
    .sort((left, right) => right.foregroundPixels - left.foregroundPixels);

  const best = candidates[0];
  if (!best) {
    throw new Error('The AI could not identify a phone case in the first image');
  }

  const bounds = best.record.bounds;
  const { width, height } = best.record.mask;
  const left = Math.round(bounds.left);
  const top = Math.round(bounds.top);
  const right = Math.round(bounds.right);
  const bottom = Math.round(bounds.bottom);

  if (
    width < 1 ||
    height < 1 ||
    width * height !== best.raster.length ||
    width * height > 4_000_000 ||
    left < 0 ||
    top < 0 ||
    right <= left ||
    bottom <= top ||
    right - left !== width ||
    bottom - top !== height
  ) {
    throw new Error('The AI returned an unusable phone-case mask');
  }

  const packedMask = Buffer.alloc(Math.ceil(best.raster.length / 8));
  for (let index = 0; index < best.raster.length; index += 1) {
    if (best.raster[index] !== 0) packedMask[index >> 3] |= 1 << (7 - (index & 7));
  }

  return {
    version: 1,
    sourceColor: sourceColor.trim(),
    encoding: 'bit-packed-msb' as const,
    width,
    height,
    left,
    top,
    right,
    bottom,
    data: packedMask.toString('base64'),
    model: 'sam-3.1',
    generatedAt: new Date()
  };
}
