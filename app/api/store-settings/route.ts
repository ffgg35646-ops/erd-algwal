import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContactSettings = { _id: string; whatsappNumber?: string; whatsappNumberRemoved?: boolean };
type FooterSettings = {
  _id: string;
  vatNumber?: string;
  barcodeFileId?: string;
  vatNumberRemoved?: boolean;
  barcodeRemoved?: boolean;
  updatedAt?: Date;
};

const DEFAULT_WHATSAPP_NUMBER = '201090466376';
const DEFAULT_VAT_NUMBER = '4353454564';

export async function GET() {
  const headers = { 'cache-control': 'no-store, max-age=0' };
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { whatsappNumber: DEFAULT_WHATSAPP_NUMBER, vatNumber: DEFAULT_VAT_NUMBER, barcodeImageUrl: '', barcodeRemoved: false },
      { headers }
    );
  }

  try {
    const db = await getDb();
    const [contact, footer] = await Promise.all([
      db.collection<ContactSettings>('store_settings').findOne({ _id: 'contact' }),
      db.collection<FooterSettings>('store_settings').findOne({ _id: 'footer' })
    ]);
    const whatsappNumber = contact?.whatsappNumberRemoved
      ? ''
      : typeof contact?.whatsappNumber === 'string' && contact.whatsappNumber !== '010593953..' ? contact.whatsappNumber : DEFAULT_WHATSAPP_NUMBER;
    const vatNumber = footer?.vatNumberRemoved
      ? ''
      : typeof footer?.vatNumber === 'string' ? footer.vatNumber : DEFAULT_VAT_NUMBER;
    const barcodeImageUrl = typeof footer?.barcodeFileId === 'string' && footer.barcodeFileId
      ? '/api/store-footer-assets/barcode/image?v=' + String(
          footer.updatedAt instanceof Date ? footer.updatedAt.getTime() : 0
        )
      : '';

    return NextResponse.json({ whatsappNumber, vatNumber, barcodeImageUrl, barcodeRemoved: footer?.barcodeRemoved === true }, { headers });
  } catch (error) {
    console.error('Store settings read failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { whatsappNumber: DEFAULT_WHATSAPP_NUMBER, vatNumber: DEFAULT_VAT_NUMBER, barcodeImageUrl: '', barcodeRemoved: false },
      { headers }
    );
  }
}
