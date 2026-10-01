import { ticketReferenceQr } from './ticket-reference-qr';
export interface TicketLayoutFlight {
  originId: string;
  destinationId: string;
  departureAt: string;
  arrivalAt?: string;
  carrierName: string;
  serviceNumber: string;
  cabinClassCode: string;
  direction?: 'OUTBOUND' | 'RETURN';
  businessOutput?: boolean;
  contractOnly?: boolean;
  baggageKg?: string | null | undefined;
  originAirport?: { code: string; name: string } | undefined;
  destinationAirport?: { code: string; name: string } | undefined;
}
export interface TicketLayoutData {
  passengerName: string;
  contractNumber?: string;
  ageCategory?: 'ADT' | 'CHD' | 'INF';
  gender?: 'M' | 'F' | null;
  issued?: boolean;
  offers: readonly TicketLayoutFlight[];
  transferDirections: readonly string[];
}
export type TicketLayoutCity = string | { name: string; code?: string };
export type TicketLayoutBrand = {
  name: string;
  logoDataUrl: string;
  companyCode?: string;
};
export type TicketLayoutAirline = { name: string; logoDataUrl?: string };
const escape = (v: unknown) =>
  String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const safeImage = (v?: string) =>
  !!v &&
  (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ||
    /^\/brand\/[A-Za-z0-9_.-]+$/.test(v) ||
    /^blob:https?:\/\/[A-Za-z0-9.:/_-]+$/.test(v));
const icon = (path: string, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const planePath =
  '<path d="M17.8 8.2 20 6a2.8 2.8 0 0 0-4-4l-2.2 2.2L3 2 2 3l9 5-4 4-4-1-1 1 5 3 3 5 1-1-1-4 4-4 5 9 1-1Z"/>';
const plane = icon(planePath, 'plane');
const passengerIcon = icon(
  '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>',
);
const referenceIcon = icon(
  '<path d="m3 10 7-7 11 11-7 7-3-3a3 3 0 0 0-4-4Z"/><path d="m10 8 6 6"/>',
);
const seatIcon = icon(
  '<path d="M6 3v10h11v5H7a3 3 0 0 1-3-3V4M7 21v-3m9 0v3M9 7v5h8"/>',
);
const statusIcon = icon(
  '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h3"/>',
);
const baggageIcon = icon(
  '<rect x="4" y="7" width="16" height="15" rx="2"/><path d="M9 7V3h6v4M8 7v15m8-15v15"/>',
);
const fmt = (v: string, options: Intl.DateTimeFormatOptions) => {
  if (!Number.isFinite(Date.parse(v))) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    ...options,
  })
    .format(new Date(v))
    .toUpperCase();
};
const day = (v: string) =>
  fmt(v, { day: '2-digit', month: 'short', year: 'numeric' });
const time = (v: string) =>
  fmt(v, { hour: '2-digit', minute: '2-digit', hour12: false });
const duration = (from: string, to?: string) => {
  const minutes = to
    ? Math.round((Date.parse(to) - Date.parse(from)) / 60000)
    : 0;
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  return [
    Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : '',
    minutes % 60 ? `${minutes % 60}m` : '',
  ]
    .filter(Boolean)
    .join(' ');
};
function landscape(name: string) {
  const tehran = /tehran|تهران/i.test(name);
  return `<svg class="landscape" viewBox="0 0 220 140" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g fill="#dce5ed">${tehran ? '<path d="M3 140V113h10V99h12v41h7V88h13v52h7V108h14v32h9V44l-9-12 13-16 3-14 3 14 13 16-9 12v96h15v-28h11v28h11V94h14v46h16v-31h12v31Z"/>' : '<path d="M0 140V133l28-22 14 6 34-34 27 9 33-20 25 19 30-22 29 27v44Z"/><path d="M155 140V76h8v64m14 0V76h8v64m14 0V76h8v64M150 71h63v9h-63Z"/>'}</g></svg>`;
}
const world =
  '<svg class="world" viewBox="0 0 260 120" aria-hidden="true"><g fill="#e6edf3"><path d="m3 30 20-14 34 1 20 18-10 18-16 6-3 26-13-10-8-24-22-7Zm55 57 19 9 8 16-9 7-14-11Zm48-51 21-21 36 8 13-10 37 15 29 22-4 16-32-1-14 15-28-1-16-27-18 8-17-10Zm20 31 30-6 15 23-19 30-20-15Zm77 32 28-10 17 11-8 14-25 3Z"/></g></svg>';
export function ticketPageHtml(
  data: TicketLayoutData,
  cities: Readonly<Record<string, TicketLayoutCity>>,
  brand: TicketLayoutBrand,
  airlines: Readonly<Record<string, TicketLayoutAirline>> = {},
  offers = data.offers,
) {
  const city = (id: string) =>
    typeof cities[id] === 'string'
      ? String(cities[id])
      : (cities[id] as { name: string } | undefined)?.name || '—';
  const airline = airlines[offers[0]?.carrierName ?? ''];
  const airlineMark = safeImage(airline?.logoDataUrl)
    ? `<img class="airline-logo" src="${airline!.logoDataUrl}" alt="${escape(airline!.name)}">`
    : `<strong class="airline-name">${escape(offers[0]?.carrierName || 'AIRLINE')}</strong>`;
  const title =
    data.ageCategory === 'INF'
      ? 'INF'
      : data.ageCategory === 'CHD'
        ? 'CHD'
        : data.gender === 'M'
          ? 'MR'
          : data.gender === 'F'
            ? 'MRS'
            : '';
  const traveler = [title, data.passengerName].filter(Boolean).join(' ');
  const qr = ticketReferenceQr(data.contractNumber || '');
  const legs = offers
    .map((offer, index) => {
      const origin = city(offer.originId),
        destination = city(offer.destinationId);
      const direction =
        offer.direction === 'RETURN'
          ? 'RETURN'
          : index === 0
            ? 'OUTBOUND'
            : 'FLIGHT';
      const cabin = offer.businessOutput
        ? 'BUSINESS'
        : offer.cabinClassCode || '—';
      const place = (
        name: string,
        airport: TicketLayoutFlight['originAirport'],
        departing: boolean,
      ) =>
        `<div class="place ${departing ? '' : 'destination'}"><b class="city" dir="auto">${escape(name)}</b><strong class="airport-code">${escape(airport?.code || '—')}</strong><span class="airport-name" dir="auto">${escape(airport?.name || '—')}</span>${departing ? `<strong class="clock">${time(offer.departureAt)}</strong><b class="flight-date">${day(offer.departureAt)}</b>` : offer.arrivalAt ? `<span class="arrival">${time(offer.arrivalAt)} · ${day(offer.arrivalAt)}</span>` : ''}</div>`;
      const baggage =
        offer.baggageKg != null && /^\d+(\.\d+)?$/.test(offer.baggageKg)
          ? `${escape(offer.baggageKg)} KG`
          : '—';
      return `<section class="leg ${direction === 'RETURN' ? 'return' : 'outbound'}"><div class="leg-head">${plane}<strong>${direction}</strong><span>${fmt(offer.departureAt, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span></div><div class="route">${landscape(origin)}<div class="destination-landscape">${landscape(destination)}</div>${place(origin, offer.originAirport, true)}<div class="flight-path"><svg viewBox="0 0 260 58" aria-hidden="true"><path d="M9 44Q130-8 251 44" stroke="#315d7d" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/><circle cx="9" cy="44" r="5.5" fill="#12aaa9"/><circle cx="251" cy="44" r="5.5" fill="#098ba0"/></svg><div class="path-plane">${plane}</div><div class="flight-facts"><span>${duration(offer.departureAt, offer.arrivalAt)}</span><span>${escape(offer.serviceNumber || '—')}</span></div><b class="route-label">${escape(origin)} &nbsp; → &nbsp; ${escape(destination)}</b><small class="carrier" dir="auto">${escape(offer.carrierName)}</small></div>${place(destination, offer.destinationAirport, false)}</div><div class="leg-foot"><div>${seatIcon}<p><span>CLASS</span><strong>${escape(cabin)}</strong></p></div><div>${statusIcon}<p><span>STATUS</span><strong>${offer.contractOnly ? 'PENDING RESERVATION' : data.issued ? 'ISSUED' : 'DRAFT'}</strong></p></div><div>${baggageIcon}<p><span>BAGGAGE</span><strong>${baggage}</strong></p></div></div></section>`;
    })
    .join('');
  return `<article class="flight-ticket"><header><div class="heading"><h1>FLIGHT TICKET</h1><p>ELECTRONIC TICKET / ITINERARY</p></div><div class="logos${brand.companyCode === 'NIYAYESH_SEIR_SAHAR' ? ' niyayesh-logos' : ''}">${airlineMark}${safeImage(brand.logoDataUrl) ? `<img class="agency-logo" src="${brand.logoDataUrl}" alt="${escape(brand.name)}">` : ''}</div></header>${!data.issued ? '<div class="draft">DRAFT — NOT VALID FOR TRAVEL / پیش‌نمایش، فاقد اعتبار سفر</div>' : ''}<section class="identity"><div><i>${passengerIcon}</i><p><span>PASSENGER</span><strong dir="auto">${escape(traveler || '—')}</strong></p></div><div><i>${referenceIcon}</i><p><span>BOOKING REFERENCE</span><strong>${escape(data.contractNumber || '—')}</strong></p></div><small>A SAFER<br>BRIGHTER<br>JOURNEY</small></section>${legs}<footer>${qr ? `<figure class="ticket-qr">${qr}<figcaption>${escape(data.contractNumber)}</figcaption></figure>` : ''}<div class="journey">${world}<span>Good<br>Journeys</span></div></footer><div class="ticket-note">${data.transferDirections.length ? `TRANSFER INCLUDED: ${escape(data.transferDirections.join(' / '))} · ` : ''}FLIGHT TIMES: TEHRAN TIME · PRESENCE 03:00 BEFORE FLIGHT TIME AT THE AIRPORT IS MANDATORY<br><span lang="fa" dir="rtl">حضور در فرودگاه ۳ ساعت قبل از پرواز الزامی است.</span></div></article>`;
}
export const ticketLayoutStyles = `
@page{size:A4 portrait;margin:0}
.flight-ticket,.flight-ticket *{box-sizing:border-box}.flight-ticket{position:relative;width:210mm;min-height:297mm;padding:7mm;color:#102e52;background:white;font-family:Arial,ReservationNazanin,sans-serif;line-height:1.15;page-break-after:always;isolation:isolate}.flight-ticket:last-child{page-break-after:auto}
.flight-ticket header{height:52mm;display:flex;align-items:flex-start;justify-content:space-between;gap:4mm}.flight-ticket h1{margin:1mm 0 2mm;font-size:34pt;font-weight:800;letter-spacing:.2mm;color:#071e44;white-space:nowrap}.flight-ticket header p{font-size:8.5pt;letter-spacing:1.3mm;margin:0;white-space:nowrap}.flight-ticket .logos{display:flex;align-items:flex-start;gap:5mm;height:32mm}.flight-ticket .airline-logo{width:34mm;height:32mm;object-fit:contain}.flight-ticket .agency-logo{width:29mm;height:31mm;object-fit:contain}.flight-ticket .airline-name{width:31mm;font-size:13pt;padding-top:8mm;overflow-wrap:anywhere}.flight-ticket .icon{width:8mm;height:8mm;flex-shrink:0}.flight-ticket .plane{fill:currentColor;stroke-width:.6}
.flight-ticket .identity{min-height:27mm;display:grid;grid-template-columns:1fr 1.12fr 18mm;align-items:center;gap:4mm;border-radius:3mm;background:linear-gradient(110deg,#f0f6fb,#eaf3fa);padding:5mm 6mm;margin-bottom:4mm}.flight-ticket .identity>div{display:flex;align-items:center;gap:5mm;min-width:0}.flight-ticket .identity>div+div{border-left:1px solid #c8d8e4;padding-left:6mm}.flight-ticket .identity i{display:grid;place-items:center;border:1px solid #193d61;border-radius:50%;width:15mm;height:15mm;flex-shrink:0}.flight-ticket .identity p{margin:0;min-width:0}.flight-ticket .identity span{display:block;font-size:8pt;margin-bottom:2mm}.flight-ticket .identity strong{display:block;font-size:12pt;color:#081e43;overflow-wrap:anywhere}.flight-ticket .identity small{font-size:5.5pt;line-height:2;letter-spacing:1mm;color:#7790a6}
.flight-ticket .leg{border:1px solid #dde7ef;border-radius:3mm;overflow:hidden;margin-bottom:4mm;break-inside:avoid;box-shadow:0 1mm 3mm #c8d9e533}.flight-ticket .leg-head{height:12mm;background:linear-gradient(110deg,#103456,#173e64);color:white;display:flex;align-items:center;gap:5mm;padding:2mm 6mm}.flight-ticket .leg.return .leg-head{background:linear-gradient(110deg,#088799,#0c90a0)}.flight-ticket .leg-head strong{font-size:13pt;letter-spacing:.2mm}.flight-ticket .leg-head>span{font-size:10pt;border-left:1px solid #93a8ba;padding-left:5mm}
.flight-ticket .route{position:relative;display:grid;grid-template-columns:1fr 1.55fr 1fr;align-items:center;gap:4mm;min-height:47mm;padding:5mm 20mm 4mm;isolation:isolate}.flight-ticket .place{display:flex;flex-direction:column;align-items:flex-start;min-width:0}.flight-ticket .city{font-size:10pt;font-weight:bold;text-transform:uppercase}.flight-ticket .airport-code{font-size:32pt;font-weight:800;color:#071e44;margin:.8mm 0}.flight-ticket .airport-name{font-size:7.5pt;max-width:35mm;min-height:8mm}.flight-ticket .clock{font-size:17pt;color:#081e43;margin-top:1.5mm}.flight-ticket .flight-date{font-size:11pt;margin-top:.8mm}.flight-ticket .destination{align-self:start;padding-top:0}.flight-ticket .arrival{font-size:7pt;margin-top:4mm;line-height:1.4}.flight-ticket .landscape{position:absolute;width:40mm;height:37mm;bottom:0;left:0;z-index:-1;opacity:.7}.flight-ticket .destination-landscape{position:absolute;inset:0;z-index:-1;pointer-events:none}.flight-ticket .destination-landscape .landscape{left:auto;right:0;transform:scaleX(-1)}
.flight-ticket .flight-path{text-align:center;position:relative;padding-top:10mm;min-width:0}.flight-ticket .flight-path>svg{width:100%;height:15mm;display:block}.flight-ticket .path-plane{position:absolute;top:10mm;left:calc(50% - 4mm);transform:rotate(45deg);color:#124361}.flight-ticket .path-plane .icon{width:8mm;height:8mm}.flight-ticket .flight-facts{display:flex;align-items:center;justify-content:center;gap:5mm;margin:1mm 0 2mm;font-size:8pt}.flight-ticket .flight-facts span+span{border-left:1px solid #567187;padding-left:5mm}.flight-ticket .route-label{display:block;font-size:8.5pt;letter-spacing:.5mm;text-transform:uppercase;overflow-wrap:anywhere}.flight-ticket .carrier{display:block;font-size:6.5pt;color:#648197;margin-top:2mm}
.flight-ticket .leg-foot{display:grid;grid-template-columns:repeat(3,1fr);background:#f6fafc;border-top:1px solid #e2ebf2;min-height:16mm;padding:3mm 9mm;gap:4mm}.flight-ticket .leg-foot>div{display:flex;align-items:center;gap:4mm}.flight-ticket .leg-foot>div+div{border-left:1px solid #c8d8e4;padding-left:8mm}.flight-ticket .leg-foot p{margin:0}.flight-ticket .leg-foot span{display:block;font-size:7.5pt;margin-bottom:1mm}.flight-ticket .leg-foot strong{font-size:9pt;color:#0b2245}
.flight-ticket footer{display:flex;justify-content:space-between;align-items:center;min-height:29mm;margin-top:1mm}.flight-ticket .ticket-qr{margin:0;padding:1mm;background:#f2f7fb;border-radius:2mm;width:29mm}.flight-ticket .ticket-qr svg{display:block;width:26mm;height:26mm}.flight-ticket .ticket-qr figcaption{font-size:5pt;text-align:center;overflow-wrap:anywhere}.flight-ticket .journey{position:relative;width:67mm;height:30mm}.flight-ticket .world{width:100%;height:100%}.flight-ticket .journey span{position:absolute;right:2mm;bottom:1mm;color:#1396a5;font-family:cursive;font-style:italic;font-size:16pt;line-height:1;transform:rotate(-15deg);border-bottom:1px solid #1396a5;padding-bottom:2mm}.flight-ticket .ticket-note{font-size:5.5pt;color:#5c7890;text-align:center;margin-top:1mm}.flight-ticket .draft{font-size:8pt;color:#a62d2d;border:1px dashed #a62d2d;text-align:center;padding:1mm;margin-bottom:2mm}
`;
export function ticketDocumentHtml(
  tickets: readonly TicketLayoutData[],
  cities: Readonly<Record<string, TicketLayoutCity>>,
  brand: TicketLayoutBrand,
  airlines: Readonly<Record<string, TicketLayoutAirline>> = {},
) {
  if (!tickets.length) throw new Error('TICKET_DATA_MISSING');
  if (!safeImage(brand.logoDataUrl)) throw new Error('TICKET_LOGO_INVALID');
  const pages = tickets
    .flatMap((ticket) =>
      Array.from({ length: Math.ceil(ticket.offers.length / 2) }, (_, page) =>
        ticketPageHtml(
          ticket,
          cities,
          brand,
          airlines,
          ticket.offers.slice(page * 2, page * 2 + 2),
        ),
      ),
    )
    .join('');
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><style>html,body{margin:0;background:white}${ticketLayoutStyles}</style></head><body>${pages}</body></html>`;
}
