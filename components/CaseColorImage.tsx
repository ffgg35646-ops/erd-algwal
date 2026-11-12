'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ProductColorMask } from '@/lib/products';

const COLOR_HEX: Record<string, string> = {
  'أسود': '#171717', 'اسود': '#171717', black: '#171717',
  'أبيض': '#fafafa', 'ابيض': '#fafafa', white: '#fafafa',
  'أحمر': '#d93642', 'احمر': '#d93642', red: '#d93642',
  'أصفر': '#f3cb3d', 'اصفر': '#f3cb3d', yellow: '#f3cb3d',
  'أزرق': '#2874d9', 'ازرق': '#2874d9', blue: '#2874d9',
  'أخضر': '#299660', 'اخضر': '#299660', green: '#299660',
  'بنفسجي': '#8255c5', purple: '#8255c5',
  'وردي': '#f09ab9', pink: '#f09ab9',
  'بني': '#805438', brown: '#805438',
  'برتقالي': '#ee851d', orange: '#ee851d',
  'رمادي': '#92969c', gray: '#92969c', grey: '#92969c',
  'ذهبي': '#c8a04c', gold: '#c8a04c',
  'فضي': '#c6cbd1', silver: '#c6cbd1',
  'تيتانيوم طبيعي': '#aaa69d', 'تيتانيوم': '#aaa69d',
  'أزرق داكن': '#1d355c', 'ازرق داكن': '#1d355c',
  'كحلي': '#1d355c', 'الكحلي': '#1d355c', 'كحلى': '#1d355c', navy: '#1d355c',
  'جليدي': '#dce8f4', 'الجليدي': '#dce8f4', 'خمري': '#76263f',
  'عنابي': '#76263f', 'العنابي': '#76263f', burgundy: '#76263f', maroon: '#76263f',
  'برتقالي كوني': '#e87932', 'أزرق ضبابي': '#a9c4dd',
  'أخضر مريمي': '#97aa92', 'أبيض سحابي': '#f5f5f0',
  'ذهبي فاتح': '#d9c59e', 'وردي ناعم': '#f4cbd5',
  'أسود فضائي': '#292d37', 'تيتانيوم أسود': '#55565a', 'تايتانيوم أسود': '#55565a',
  'تيتانيوم أبيض': '#e6e4df', 'تيتانيوم صحراوي': '#bfa58b', 'تايتانيوم صحراوي': '#bfa58b',
  'أزرق سماوي': '#9dc8e9'
};

function getColorHex(color: string) {
  const key = color.trim().toLocaleLowerCase('ar');
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(key)) return key;
  return COLOR_HEX[key] || '#b7b7b7';
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { hue, saturation, lightness };
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (section >= 0 && section < 1) [red, green] = [chroma, secondary];
  else if (section < 2) [red, green] = [secondary, chroma];
  else if (section < 3) [green, blue] = [chroma, secondary];
  else if (section < 4) [green, blue] = [secondary, chroma];
  else if (section < 5) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];

  const offset = lightness - chroma / 2;
  return [
    Math.round((red + offset) * 255),
    Math.round((green + offset) * 255),
    Math.round((blue + offset) * 255)
  ] as const;
}

function recolorMaskedCase(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  mask: ProductColorMask,
  selectedColor: string
) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;

  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  const right = mask.left + mask.width;
  const bottom = mask.top + mask.height;
  if (
    imageWidth < 1 ||
    imageHeight < 1 ||
    mask.width < 1 ||
    mask.height < 1 ||
    mask.width * mask.height > 4_000_000 ||
    mask.left < 0 ||
    mask.top < 0 ||
    right > imageWidth ||
    bottom > imageHeight
  ) {
    return false;
  }

  let binaryMask: Uint8Array;
  try {
    const decoded = window.atob(mask.data);
    binaryMask = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return false;
  }
  const pixelCount = mask.width * mask.height;
  if (mask.encoding !== 'bit-packed-msb' || binaryMask.length !== Math.ceil(pixelCount / 8)) return false;

  const sourceHex = getColorHex(mask.sourceColor);
  const targetHex = getColorHex(selectedColor);
  if (sourceHex === targetHex) return false;

  const parseHex = (hex: string) => {
    const value = hex.replace('#', '');
    const normalized = value.length === 3
      ? value.split('').map((part) => part + part).join('')
      : value;
    const number = Number.parseInt(normalized, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255
    };
  };

  const target = parseHex(targetHex);
  const targetHsl = rgbToHsl(target.r, target.g, target.b);

  canvas.width = imageWidth;
  canvas.height = imageHeight;
  context.drawImage(image, 0, 0, imageWidth, imageHeight);

  // Read and update only the case's bounding rectangle, not the full photo.
  const pixels = context.getImageData(mask.left, mask.top, mask.width, mask.height);

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const maskIndex = y * mask.width + x;
      const isCasePixel = (binaryMask[maskIndex >> 3] & (1 << (7 - (maskIndex & 7)))) !== 0;
      if (!isCasePixel) continue;

      const pixelIndex = maskIndex * 4;
      const original = rgbToHsl(
        pixels.data[pixelIndex],
        pixels.data[pixelIndex + 1],
        pixels.data[pixelIndex + 2]
      );

      let saturation = targetHsl.saturation;
      let lightness = original.lightness;

      // Neutral colors need a tonal transform as well as a hue change.
      if (targetHsl.saturation < 0.12) {
        saturation = 0;
        if (targetHsl.lightness < 0.18) {
          lightness = original.lightness * 0.3;
        } else if (targetHsl.lightness > 0.88) {
          lightness = 0.72 + original.lightness * 0.28;
        } else {
          lightness = 0.46 + (original.lightness - 0.5) * 0.62;
        }
      } else {
        // Keep the source highlights and shadows, while applying the new hue.
        saturation = Math.min(0.96, targetHsl.saturation * (0.72 + original.saturation * 0.28));
      }

      const [red, green, blue] = hslToRgb(targetHsl.hue, saturation, Math.min(0.98, Math.max(0.035, lightness)));
      pixels.data[pixelIndex] = red;
      pixels.data[pixelIndex + 1] = green;
      pixels.data[pixelIndex + 2] = blue;
    }
  }

  context.putImageData(pixels, mask.left, mask.top);
  return true;
}

export default function CaseColorImage({
  src,
  alt,
  mask,
  selectedColor,
  className,
  style
}: {
  src: string;
  alt: string;
  mask: ProductColorMask;
  selectedColor: string;
  className?: string;
  style?: CSSProperties;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [recolored, setRecolored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    setRecolored(false);

    if (!image || !canvas || !selectedColor) return;

    const render = () => {
      if (cancelled || !image.naturalWidth || image.dataset.fallback === 'true') return;
      try {
        const didRender = recolorMaskedCase(image, canvas, mask, selectedColor);
        if (!cancelled) setRecolored(didRender);
      } catch {
        // Keep the original uploaded photo visible if the browser cannot process it.
        if (!cancelled) setRecolored(false);
      }
    };

    const handleError = () => {
      if (!cancelled) setRecolored(false);
    };

    image.addEventListener('load', render);
    image.addEventListener('error', handleError);
    if (image.complete && image.naturalWidth > 0) render();

    return () => {
      cancelled = true;
      image.removeEventListener('load', render);
      image.removeEventListener('error', handleError);
    };
  }, [src, mask, selectedColor]);

  return (
    <>
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, display: recolored ? 'none' : style?.display }}
        loading="eager"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.dataset.fallback = 'true';
          event.currentTarget.src = '/product-image-placeholder.svg';
        }}
      />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        className={className}
        style={{ ...style, display: recolored ? 'block' : 'none' }}
      />
    </>
  );
}
