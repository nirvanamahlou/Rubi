import { readPublicDocument } from '@/modules/travel-documents/server/public-document-store';
import { publicDocumentContentSecurityPolicy } from '@/modules/travel-documents/server/public-document-headers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': publicDocumentContentSecurityPolicy,
};
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const html = await readPublicDocument(token).catch(() => undefined);
  return new Response(html ?? 'Document unavailable', {
    status: html ? 200 : 404,
    headers: {
      ...headers,
      'Content-Type': html
        ? 'text/html; charset=utf-8'
        : 'text/plain; charset=utf-8',
    },
  });
}
