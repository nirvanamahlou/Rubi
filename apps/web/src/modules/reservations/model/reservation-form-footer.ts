import { reservationFormQr } from '@/components/travel/reservation-form-qr';
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export const reservationContactEmail = 'Reservation@niyayehseir.com';
export function reservationFormFooterHtml(
  id: string,
  origin = '',
  companyCode?: string,
  brandName = '',
) {
  let url = '';
  if (/^[0-9a-f-]{36}$/i.test(id) && origin) {
    try {
      const parsed = new URL(origin);
      if (['http:', 'https:'].includes(parsed.protocol))
        url = parsed.origin + '/r/' + id;
    } catch {
      /* No untrusted or unavailable URL in the output. */
    }
  }
  const qr = url ? reservationFormQr(url) : null;
  const contact =
    companyCode && companyCode !== 'NIYAYESH_SEIR_SAHAR'
      ? `<div data-reservation-contact><strong>${escape(companyCode === 'JAHAN_BASTAN' ? 'جهان باستان' : brandName)}</strong></div>`
      : `<div data-reservation-contact><strong>RESERVATIONS CONTACT</strong><span>Nystkt.ir · 021-72075000</span><a href="mailto:${reservationContactEmail}">${reservationContactEmail}</a></div>`;
  return `${contact}${qr ? `<a data-reservation-qr href="${escape(url)}" aria-label="مشاهده فرم رزواسیون">${qr}<small>SCAN TO VIEW FORM</small></a>` : ''}`;
}
