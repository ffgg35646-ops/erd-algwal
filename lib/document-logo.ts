export type DocumentLogoSettings = {
  _id: string;
  documentLogoImageDataBase64?: string;
  documentLogoContentType?: string;
};

const DOCUMENT_LOGO_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif'
]);

export function getDocumentLogoDataUri(
  settings: DocumentLogoSettings | null | undefined
): string | null {
  const imageData = settings?.documentLogoImageDataBase64;
  const contentType = settings?.documentLogoContentType;

  if (
    typeof imageData !== 'string' ||
    !imageData ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData) ||
    typeof contentType !== 'string' ||
    !DOCUMENT_LOGO_CONTENT_TYPES.has(contentType)
  ) {
    return null;
  }

  return 'data:' + contentType + ';base64,' + imageData;
}
