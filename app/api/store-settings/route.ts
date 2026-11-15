import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContactSettings = { _id: string; whatsappNumber?: string; whatsappNumberRemoved?: boolean };
type FooterSettings = {
  _id: string;
  vatNumber?: string;
  barcodeFileId?: string;
  imageDataBase64?: string;
  vatNumberRemoved?: boolean;
  barcodeRemoved?: boolean;
  iconOneImageUrl?: string;
  iconOneLinkUrl?: string;
  iconOneImageDataBase64?: string;
  iconTwoImageUrl?: string;
  iconTwoLinkUrl?: string;
  iconTwoImageDataBase64?: string;
  updatedAt?: Date;
};

const DEFAULT_WHATSAPP_NUMBER = '201090466376';
const DEFAULT_VAT_NUMBER = '4353454564';

export async function GET() {
  const headers = { 'cache-control': 'no-store, max-age=0' };
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Store settings are temporarily unavailable' }, { status: 503, headers });
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
    const version = String(footer?.updatedAt instanceof Date ? footer.updatedAt.getTime() : 0);
    const barcodeConfigured = footer?.barcodeRemoved !== true && (
      (typeof footer?.imageDataBase64 === 'string' && footer.imageDataBase64.length > 0) ||
      (typeof footer?.barcodeFileId === 'string' && footer.barcodeFileId.length > 0)
    );
    const barcodeImageUrl = barcodeConfigured
      ? '/api/store-footer-assets/barcode/image?v=' + version
      : '';
    const iconOneImageUrl = footer?.iconOneImageUrl ||
      (footer?.iconOneImageDataBase64 ? '/api/store-footer-assets/icon/one/image?v=' + version : '');
    const iconTwoImageUrl = footer?.iconTwoImageUrl ||
      (footer?.iconTwoImageDataBase64 ? '/api/store-footer-assets/icon/two/image?v=' + version : '');

    return NextResponse.json({
      whatsappNumber,
      vatNumber,
      barcodeImageUrl,
      barcodeConfigured,
      barcodeRemoved: footer?.barcodeRemoved === true,
      footerIcons: [
        { imageUrl: iconOneImageUrl, linkUrl: footer?.iconOneLinkUrl || '', label: 'الأيقونة الأولى' },
        { imageUrl: iconTwoImageUrl, linkUrl: footer?.iconTwoLinkUrl || '', label: 'الأيقونة الثانية' }
      ]
    }, { headers });
  } catch (error) {
    console.error('Store settings read failed:', error instanceof Error ? error.message : 'Unknown error');
    // Do not turn a temporary database failure into a successful empty settings payload.
    // The footer keeps its last known barcode until a later request succeeds.
    return NextResponse.json({ error: 'Store settings are temporarily unavailable' }, { status: 503, headers });
  }
}
