import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContactSettings = { _id: string; whatsappNumber?: string };
type FooterSettings = {
  _id: string;
  vatNumber?: string;
  barcodeFileId?: string;
  updatedAt?: Date;
};

export async function GET() {
  const headers = { 'cache-control': 'no-store, max-age=0' };
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { whatsappNumber: '', vatNumber: '', barcodeImageUrl: '' },
      { headers }
    );
  }

  try {
    const db = await getDb();
    const [contact, footer] = await Promise.all([
      db.collection<ContactSettings>('store_settings').findOne({ _id: 'contact' }),
      db.collection<FooterSettings>('store_settings').findOne({ _id: 'footer' })
    ]);
    const whatsappNumber = typeof contact?.whatsappNumber === 'string'
      ? contact.whatsappNumber
      : '';
    const vatNumber = typeof footer?.vatNumber === 'string' ? footer.vatNumber : '';
    const barcodeImageUrl = typeof footer?.barcodeFileId === 'string' && footer.barcodeFileId
      ? '/api/store-footer-assets/barcode/image?v=' + String(
          footer.updatedAt instanceof Date ? footer.updatedAt.getTime() : 0
        )
      : '';

    return NextResponse.json({ whatsappNumber, vatNumber, barcodeImageUrl }, { headers });
  } catch (error) {
    console.error('Store settings read failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { whatsappNumber: '', vatNumber: '', barcodeImageUrl: '' },
      { headers }
    );
  }
}
