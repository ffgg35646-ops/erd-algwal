'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

type EditorInfo = {
  productName: string;
  imageUrl: string;
};

type MaskPayload = {
  encoding: 'bit-packed-msb';
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  data: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary);
}

export default function CaseMaskEditor({ productId, token }: { productId: string; token: string }) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const previousPointRef = useRef<{ x: number; y: number } | null>(null);
  const [info, setInfo] = useState<EditorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [mode, setMode] = useState<'paint' | 'erase'>('paint');
  const [selected, setSelected] = useState(false);
  const [status, setStatus] = useState('جاري تحميل صورة الغلاف...');

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ token });
    void fetch('/api/products/' + encodeURIComponent(productId) + '/color-mask?' + query.toString(), {
      cache: 'no-store'
    }).then(async (response) => {
      const payload = await response.json() as { error?: string; product?: EditorInfo };
      if (!response.ok || !payload.product) throw new Error(payload.error || 'الرابط غير صالح أو انتهت صلاحيته.');
      if (!cancelled) setInfo(payload.product);
    }).catch((error) => {
      if (!cancelled) setStatus(error instanceof Error ? error.message : 'تعذر فتح أداة التحديد.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [productId, token]);

  useEffect(() => {
    if (!info?.imageUrl) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.width = image.naturalWidth;
      overlay.height = image.naturalHeight;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = image.naturalWidth;
      maskCanvas.height = image.naturalHeight;
      maskCanvasRef.current = maskCanvas;
      setStatus('ارسم فوق الكفر فقط باللون الأخضر، ثم احفظ التحديد.');
    };
    image.onerror = () => {
      if (!cancelled) setStatus('تعذر تحميل صورة الغلاف. تحقق من صورة المنتج وحاول مرة أخرى.');
    };
    image.src = info.imageUrl;
    return () => { cancelled = true; };
  }, [info?.imageUrl]);

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
      scale: canvas.width / rect.width
    };
  }

  function drawSegment(
    from: { x: number; y: number },
    to: { x: number; y: number },
    scale: number
  ) {
    const overlay = overlayRef.current;
    const maskCanvas = maskCanvasRef.current;
    const overlayContext = overlay?.getContext('2d');
    const maskContext = maskCanvas?.getContext('2d');
    if (!overlay || !overlayContext || !maskContext) return;

    const erase = mode === 'erase';
    const lineWidth = Math.max(1, brushSize * scale);
    for (const context of [overlayContext, maskContext]) {
      context.save();
      context.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      context.strokeStyle = erase ? 'rgba(0,0,0,1)' : (context === overlayContext ? 'rgba(16,185,129,0.48)' : '#ffffff');
      context.fillStyle = erase ? 'rgba(0,0,0,1)' : (context === overlayContext ? 'rgba(16,185,129,0.48)' : '#ffffff');
      context.lineWidth = lineWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      if (from.x === to.x && from.y === to.y) {
        context.beginPath();
        context.arc(from.x, from.y, lineWidth / 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
    setSelected(true);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (saving || loading || !maskCanvasRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    if (!point) return;
    drawingRef.current = true;
    previousPointRef.current = point;
    drawSegment(point, point, point.scale);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    const previous = previousPointRef.current;
    if (!point || !previous) return;
    drawSegment(previous, point, point.scale);
    previousPointRef.current = point;
  }

  function stopDrawing() {
    drawingRef.current = false;
    previousPointRef.current = null;
  }

  function clearSelection() {
    const overlay = overlayRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!overlay || !maskCanvas) return;
    overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    maskCanvas.getContext('2d')?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setSelected(false);
    setStatus('تم مسح التحديد. ارسم فوق الكفر فقط.');
  }

  async function saveMask() {
    const canvas = maskCanvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context || !selected || saving) return;

    setSaving(true);
    setStatus('جاري تجهيز القناع وحفظه...');
    try {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width;
      let top = canvas.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const alpha = pixels.data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 10) {
            if (x < left) left = x;
            if (y < top) top = y;
            if (x > right) right = x;
            if (y > bottom) bottom = y;
          }
        }
      }
      if (right < left || bottom < top) throw new Error('لم يتم تحديد أي جزء من الصورة.');
      right += 1;
      bottom += 1;
      const width = right - left;
      const height = bottom - top;
      const pixelCount = width * height;
      if (pixelCount > 4_000_000) {
        throw new Error('مساحة التحديد كبيرة جدًا. قلّل مساحة التحديد لتشمل الكفر فقط.');
      }

      const packed = new Uint8Array(Math.ceil(pixelCount / 8));
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const originalIndex = ((top + y) * canvas.width + (left + x)) * 4 + 3;
          if (pixels.data[originalIndex] > 10) {
            const index = y * width + x;
            packed[index >> 3] |= 1 << (7 - (index & 7));
          }
        }
      }

      const mask: MaskPayload = {
        encoding: 'bit-packed-msb',
        width,
        height,
        left,
        top,
        right,
        bottom,
        data: bytesToBase64(packed)
      };
      const response = await fetch('/api/products/' + encodeURIComponent(productId) + '/color-mask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, mask })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'تعذر حفظ القناع.');
      setStatus('تم حفظ قناع الكفر بنجاح. يمكنك الرجوع إلى صفحة المنتج وتجربة الألوان.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ القناع.');
    } finally {
      setSaving(false);
    }
  }

  const imageLoaded = Boolean(info && !loading && maskCanvasRef.current);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px 48px', color: '#171717' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>تحديد الكفر مجانًا</h1>
        <p style={{ margin: 0, color: '#555', lineHeight: 1.8 }}>
          {info?.productName || 'معاينة صورة الغلاف'}
        </p>
      </header>

      <section style={{ background: '#f7f7f7', border: '1px solid #ddd', borderRadius: 14, padding: 14, marginBottom: 16, lineHeight: 1.9 }}>
        <strong>طريقة الاستخدام:</strong>
        <div>1. ارسم بالفرشاة الخضراء فوق مساحة الكفر فقط.</div>
        <div>2. بدّل إلى الممحاة لإزالة أي تحديد وصل للخلفية.</div>
        <div>3. اضغط «حفظ القناع». الخلفية وباقي صور المنتج لن تتغير.</div>
      </section>

      {loading ? (
        <p style={{ padding: 24, textAlign: 'center' }}>{status}</p>
      ) : info ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button type="button" onClick={() => setMode('paint')} disabled={saving} aria-pressed={mode === 'paint'} style={toolButton(mode === 'paint')}>
              <span aria-hidden="true">🖌️</span> فرشاة التحديد
            </button>
            <button type="button" onClick={() => setMode('erase')} disabled={saving} aria-pressed={mode === 'erase'} style={toolButton(mode === 'erase')}>
              <span aria-hidden="true">🧽</span> ممحاة
            </button>
            <button type="button" onClick={clearSelection} disabled={saving || !imageLoaded} style={toolButton(false)}>
              مسح التحديد
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto', minWidth: 180 }}>
              حجم الفرشاة
              <input type="range" min="6" max="64" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} disabled={saving} />
            </label>
          </div>

          <div style={{ position: 'relative', width: '100%', lineHeight: 0, border: '1px solid #ccc', borderRadius: 12, overflow: 'hidden', background: '#eee' }}>
            <img src={info.imageUrl} alt="صورة غلاف المنتج" draggable={false} style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none' }} />
            <canvas
              ref={overlayRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onLostPointerCapture={stopDrawing}
              aria-label="ارسم فوق الكفر لتحديد الجزء الذي سيتغير لونه"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: mode === 'erase' ? 'cell' : 'crosshair' }}
            />
          </div>

          <button type="button" onClick={() => void saveMask()} disabled={!selected || saving || !imageLoaded} style={{ ...toolButton(false), width: '100%', marginTop: 16, padding: '14px 18px', background: '#111', color: '#fff', borderColor: '#111', opacity: saving || !selected ? 0.55 : 1 }}>
            {saving ? 'جاري الحفظ...' : 'حفظ قناع الكفر'}
          </button>
        </>
      ) : (
        <p role="alert" style={{ color: '#9b1c1c', padding: 18, background: '#fff1f1', borderRadius: 12 }}>{status}</p>
      )}

      <p aria-live="polite" style={{ marginTop: 14, color: status.includes('بنجاح') ? '#176b3a' : '#555', lineHeight: 1.8 }}>{status}</p>
    </main>
  );
}

function toolButton(active: boolean): CSSProperties {
  return {
    border: '1px solid ' + (active ? '#168a57' : '#ccc'),
    borderRadius: 10,
    padding: '10px 14px',
    background: active ? '#e8f7ef' : '#fff',
    color: '#171717',
    fontWeight: 700,
    cursor: 'pointer'
  };
}
