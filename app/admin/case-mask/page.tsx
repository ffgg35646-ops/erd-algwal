import CaseMaskEditor from '@/components/CaseMaskEditor';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'تحديد الكفر',
  robots: { index: false, follow: false }
};

export default async function CaseMaskEditorPage({
  searchParams
}: {
  searchParams: Promise<{ product?: string; token?: string }>;
}) {
  const params = await searchParams;
  if (!params.product || !params.token) {
    return (
      <main style={{ maxWidth: 720, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <h1>رابط أداة التحديد غير صالح</h1>
        <p>ارجع إلى بوت الإدارة وافتح رابط تحديد الكفر من جديد.</p>
      </main>
    );
  }

  return <CaseMaskEditor productId={params.product} token={params.token} />;
}
