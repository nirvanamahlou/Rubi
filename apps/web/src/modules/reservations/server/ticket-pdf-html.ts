import type { ReservationPdfTicket } from '@/modules/reservations/model/reservation-tickets';

type City = string | { name: string; code?: string };
type Airline = { name: string; logoDataUrl?: string };
const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const validImage = (value: string | undefined) =>
  !!value && imagePattern.test(value);
const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(value))
    .toUpperCase();
const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
const prefix = (ticket: ReservationPdfTicket) =>
  ticket.ageCategory === 'INF'
    ? 'INF'
    : ticket.ageCategory === 'CHD'
      ? 'CHD'
      : ticket.gender === 'F'
        ? 'MRS'
        : ticket.gender === 'M'
          ? 'MR'
          : '';
const label = (value: string) => '<span class="label">' + value + '</span>';

export function ticketPdfHtml(
  tickets: readonly ReservationPdfTicket[],
  cities: Readonly<Record<string, City>>,
  branding: { name: string; logoDataUrl: string; companyCode?: string },
  airlines: Readonly<Record<string, Airline>> = {},
) {
  if (!tickets.length) throw new Error('TICKET_DATA_MISSING');
  if (!validImage(branding.logoDataUrl)) throw new Error('TICKET_LOGO_INVALID');
  const city = (id: string) => {
    const item = cities[id];
    return typeof item === 'string'
      ? { name: item, code: '' }
      : item || { name: '—', code: '' };
  };
  const pages = tickets
    .map((ticket) => {
      const firstCarrier = ticket.offers[0]?.carrierName || 'AIRLINE';
      const airline = airlines[firstCarrier];
      const airlineMark =
        airline && validImage(airline.logoDataUrl)
          ? '<img class="airline-logo" src="' +
            airline.logoDataUrl +
            '" alt="' +
            escapeHtml(airline.name) +
            '">'
          : '<strong class="airline-name">' +
            escapeHtml(firstCarrier) +
            '</strong>';
      const traveler = [prefix(ticket), ticket.passengerName]
        .filter(Boolean)
        .join(' ');
      const legs = ticket.offers
        .map((offer, index) => {
          const origin = city(offer.originId);
          const destination = city(offer.destinationId);
          const direction =
            offer.direction === 'RETURN'
              ? 'RETURN'
              : index === 0
                ? 'OUTBOUND'
                : 'FLIGHT';
          const className = escapeHtml(
            offer.businessOutput ? 'BUSINESS' : offer.cabinClassCode || '—',
          );
          const accent = direction === 'RETURN' ? 'return' : 'outbound';
          const carrier = airlines[offer.carrierName];
          const carrierMark =
            carrier && validImage(carrier.logoDataUrl)
              ? '<img class="leg-logo" src="' +
                carrier.logoDataUrl +
                '" alt="' +
                escapeHtml(carrier.name) +
                '">'
              : escapeHtml(offer.carrierName);
          return (
            '<section class="leg ' +
            accent +
            '"><div class="leg-head"><strong>✈ &nbsp;' +
            direction +
            '</strong><span>' +
            escapeHtml(date(offer.departureAt)) +
            '</span><span>' +
            className +
            ' CLASS</span></div><div class="route"><div class="place">' +
            label('FROM') +
            '<strong class="code">' +
            escapeHtml(origin.code || origin.name) +
            '</strong><b>' +
            escapeHtml(origin.name) +
            '</b><strong class="clock">' +
            escapeHtml(time(offer.departureAt)) +
            '</strong></div><div class="flight-path"><span>✈</span><i></i><small>' +
            carrierMark +
            ' · ' +
            escapeHtml(offer.serviceNumber || '—') +
            '</small></div><div class="place destination">' +
            label('TO') +
            '<strong class="code">' +
            escapeHtml(destination.code || destination.name) +
            '</strong><b>' +
            escapeHtml(destination.name) +
            '</b>' +
            (offer.arrivalAt
              ? '<strong class="clock">' +
                escapeHtml(time(offer.arrivalAt)) +
                '</strong>'
              : '') +
            '</div></div><div class="leg-foot"><div>' +
            label('CLASS') +
            '<strong>' +
            className +
            '</strong></div><div>' +
            label('STATUS') +
            '<strong>ISSUED</strong></div><div>' +
            label('FLIGHT NO.') +
            '<strong>' +
            escapeHtml(offer.serviceNumber || '—') +
            '</strong></div></div></section>'
          );
        })
        .join('');
      return (
        '<article class="ticket"><div class="content"><header><div><h1>FLIGHT TICKET</h1><p>ELECTRONIC TICKET / ITINERARY</p></div></header><div class="logos' +
        (branding.companyCode === 'NIYAYESH_SEIR_SAHAR'
          ? ' niyayesh-logos'
          : '') +
        '">' +
        airlineMark +
        '<img class="agency-logo" src="' +
        branding.logoDataUrl +
        '" alt="' +
        escapeHtml(branding.name) +
        '"></div><section class="identity"><div>' +
        label('PASSENGER') +
        '<strong>' +
        escapeHtml(traveler) +
        '</strong></div><div>' +
        label('BOOKING REFERENCE') +
        '<strong>' +
        escapeHtml(ticket.contractNumber || '—') +
        '</strong></div></section>' +
        legs +
        (ticket.transferDirections.length
          ? '<div class="transfer">TRANSFER INCLUDED: ' +
            escapeHtml(ticket.transferDirections.join(' / ')) +
            '</div>'
          : '') +
        '<div class="warning"><strong>PRESENCE 03:00 BEFORE FLIGHT TIME AT THE AIRPORT IS MANDATORY</strong><strong lang="fa" dir="rtl">حضور در فرودگاه ۳ ساعت قبل از پرواز الزامی است.</strong></div></div><footer><span>FLY FURTHER TOGETHER</span><span>' +
        escapeHtml(branding.name) +
        '</span></footer></article>'
      );
    })
    .join('');
  return (
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#102e52;font-family:Arial,ReservationNazanin,sans-serif}.ticket{width:210mm;height:297mm;page-break-after:always;display:flex;flex-direction:column;overflow:hidden}.ticket:last-child{page-break-after:auto}.content{padding:10mm 9mm 5mm;flex:1}header h1{font-size:30pt;letter-spacing:1mm;margin:0;color:#102750}header p{margin:2mm 0 0;font-size:9pt;letter-spacing:1.6mm}.logos{display:flex;align-items:center;justify-content:space-between;height:37mm;padding:5mm 3mm}.airline-logo{max-width:58mm;max-height:27mm;object-fit:contain}.airline-name{max-width:70mm;font-size:17pt;color:#143257}.agency-logo{width:39mm;height:32mm;object-fit:contain}.identity{display:grid;grid-template-columns:1fr 1fr;gap:5mm;border-radius:4mm;background:#edf5fd;padding:7mm 8mm;margin-bottom:5mm}.identity>div+div{border-left:1px solid #bfd0df;padding-left:8mm}.label{display:block;color:#54708d;font-size:8pt;font-weight:normal;letter-spacing:.3mm;margin-bottom:1mm}.identity strong{display:block;font-size:15pt;color:#102750;overflow-wrap:anywhere}.leg{border:1px solid #d4e1eb;border-radius:4mm;overflow:hidden;margin:0 0 5mm;break-inside:avoid}.leg-head{background:#12375d;color:#fff;display:flex;align-items:center;gap:6mm;padding:4mm 6mm;font-size:11pt}.leg-head span:last-child{margin-left:auto;font-size:8pt;letter-spacing:.7mm}.leg.return .leg-head{background:#0b8c9a}.route{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:2mm;align-items:center;padding:7mm 8mm;min-height:47mm}.place{display:flex;flex-direction:column;align-items:flex-start;position:relative;isolation:isolate;min-height:34mm;justify-content:center}.place::before{content:"";position:absolute;inset:1mm -1mm;z-index:-1;background:#d8e5f1;opacity:.42;clip-path:polygon(0 100%,0 82%,8% 82%,8% 63%,15% 63%,15% 81%,22% 81%,22% 73%,29% 73%,29% 53%,34% 53%,34% 17%,37% 0,40% 17%,40% 53%,45% 53%,45% 78%,54% 78%,54% 66%,61% 66%,61% 84%,69% 84%,69% 57%,77% 57%,77% 71%,85% 71%,85% 48%,93% 48%,93% 79%,100% 79%,100% 100%)}.place.destination{align-items:flex-end;text-align:right}.place.destination::before{transform:scaleX(-1)}.code{font-size:26pt;line-height:1;color:#102750}.place b{font-size:10pt;margin-top:1mm}.clock{font-size:13pt;margin-top:4mm}.flight-path{text-align:center;color:#1397aa}.flight-path span{font-size:21pt}.flight-path i{display:block;border-top:1px dashed #638aa4;margin:1mm}.flight-path small{display:block;font-size:7pt;color:#415d77;overflow-wrap:anywhere}.leg-logo{display:inline-block;max-width:19mm;max-height:6mm;vertical-align:middle;object-fit:contain}.leg-foot{display:grid;grid-template-columns:repeat(3,1fr);background:#f0f7fc;border-top:1px solid #dae5ee;padding:4mm 6mm}.leg-foot>div+div{border-left:1px solid #ccdae5;padding-left:6mm}.leg-foot strong{font-size:10pt}.transfer{font-size:8pt;padding:1mm 2mm}.warning{margin-top:5mm;border:1px solid #b5d7df;border-radius:2mm;padding:4mm 5mm;color:#143c5c;display:flex;flex-direction:column;gap:2mm;text-align:center;font-size:9pt}.warning [lang=fa]{font-family:ReservationNazanin,Arial,sans-serif;font-size:11pt}footer{height:16mm;background:#12375d;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:0 9mm;font-size:8pt;letter-spacing:.7mm}' +
    '.logos.niyayesh-logos{height:43mm;padding:2mm 3mm}.niyayesh-logos .agency-logo{width:48mm;height:38mm}' +
    '</style></head><body>' +
    pages +
    '</body></html>'
  );
}
