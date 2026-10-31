import { reservationFormQr } from '@/components/travel/reservation-form-qr';
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export function publicDocumentQr(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !/^\/d\/[A-Za-z0-9_-]{32}$/.test(parsed.pathname)
    )
      return null;
    const svg = reservationFormQr(url);
    return svg
      ? `<a href="${escape(url)}" target="_blank" rel="noreferrer noopener" data-public-document-qr>${svg}</a>`
      : null;
  } catch {
    return null;
  }
}
