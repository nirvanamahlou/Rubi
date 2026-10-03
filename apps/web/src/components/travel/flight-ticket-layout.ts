import { ticketSkyline, ticketWorldMap } from './ticket-artwork';
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
  eTicketNumber?: string;
  recordLocator?: string;
  issuedAt?: string;
  offers: readonly TicketLayoutFlight[];
  transferDirections: readonly string[];
}
export type TicketLayoutCity = string | { name: string; code?: string };
export type TicketLayoutBrand = {
  name: string;
  logoDataUrl: string;
  companyCode?: string;
};
export type TicketLayoutAirline = {
  name: string;
  code?: string;
  logoDataUrl?: string;
};
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
const plane = `<svg class="icon plane" viewBox="0 0 64 64" aria-hidden="true"><path d="M59 29c3 1 3 5 0 6l-20 3-12 19h-6l6-20-16-1-6 7H1l4-11-4-11h4l6 7 16-1-6-20h6l12 19Z" fill="currentColor"/></svg>`;
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
  const carrier = [airline?.code, offers[0]?.carrierName]
    .filter(Boolean)
    .join(' — ');
  const documentInfo = `<section class="document-info"><div><span>E-Ticket No</span><strong>${escape(data.eTicketNumber || '')}</strong></div><div><span>AIRLINE</span><strong>${escape(carrier)}</strong></div><div><span>RLOC</span><strong>${escape(offers.map((offer) => `${city(offer.originId)} → ${city(offer.destinationId)}`).join(' / '))}</strong></div><div><span>DATE OF ISSUE</span><strong>${data.issuedAt && Number.isFinite(Date.parse(data.issuedAt)) ? day(data.issuedAt) : ''}</strong></div></section>`;
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
        `<div class="place ${departing ? '' : 'destination'}"><b class="city" dir="auto">${escape(name)}</b><strong class="airport-code">${escape(airport?.code || '')}</strong><span class="airport-name" dir="auto">${escape(airport?.name || '')}</span>${departing ? `<strong class="clock">${time(offer.departureAt)}</strong><b class="flight-date">${day(offer.departureAt)}</b>` : offer.arrivalAt ? `<span class="arrival">${time(offer.arrivalAt)} · ${day(offer.arrivalAt)}</span>` : ''}</div>`;
      const baggage =
        offer.baggageKg != null && /^\d+(\.\d+)?$/.test(offer.baggageKg)
          ? `${escape(offer.baggageKg)} KG`
          : '—';
      return `<section class="leg ${direction === 'RETURN' ? 'return' : 'outbound'}"><div class="leg-head">${plane}<strong>${direction}</strong><span>${fmt(offer.departureAt, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span></div><div class="route">${ticketSkyline(origin)}<div class="destination-landscape">${ticketSkyline(destination)}</div>${place(origin, offer.originAirport, true)}<div class="flight-path"><svg viewBox="0 0 260 58" aria-hidden="true"><path d="M9 44Q130-8 251 44" stroke="#315d7d" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/><circle cx="9" cy="44" r="5.5" fill="#12aaa9"/><circle cx="251" cy="44" r="5.5" fill="#098ba0"/></svg><div class="path-plane">${plane}</div><div class="flight-facts"><span>${duration(offer.departureAt, offer.arrivalAt)}</span><span>${escape(offer.serviceNumber || '—')}</span></div><b class="route-label">${escape(origin)} &nbsp; → &nbsp; ${escape(destination)}</b><small class="carrier" dir="auto">${escape(offer.carrierName)}</small></div>${place(destination, offer.destinationAirport, false)}</div><div class="leg-foot"><div>${seatIcon}<p><span>CLASS</span><strong>${escape(cabin)}</strong></p></div><div>${statusIcon}<p><span>STATUS</span><strong>${offer.contractOnly ? 'PENDING RESERVATION' : data.issued ? 'ISSUED' : 'DRAFT'}</strong></p></div><div>${baggageIcon}<p><span>BAGGAGE</span><strong>${baggage}</strong></p></div></div></section>`;
    })
    .join('');
  return `<article class="flight-ticket"><header><div class="heading"><h1>FLIGHT TICKET</h1><p>ELECTRONIC TICKET / ITINERARY</p></div><div class="logos${brand.companyCode === 'NIYAYESH_SEIR_SAHAR' ? ' niyayesh-logos' : ''}">${airlineMark}${safeImage(brand.logoDataUrl) ? `<img class="agency-logo" src="${brand.logoDataUrl}" alt="${escape(brand.name)}">` : ''}</div></header>${!data.issued ? '<div class="draft">DRAFT — NOT VALID FOR TRAVEL / پیش‌نمایش، فاقد اعتبار سفر</div>' : ''}<section class="identity"><div><i>${passengerIcon}</i><p><span>PASSENGER</span><strong dir="auto">${escape(traveler || '—')}</strong></p></div><div><i>${referenceIcon}</i><p><span>BOOKING REFERENCE</span><strong>${escape(data.contractNumber || '—')}</strong></p></div><small>A SAFER<br>BRIGHTER<br>JOURNEY</small></section>${documentInfo}${legs}<footer>${qr ? `<figure class="ticket-qr">${qr}<figcaption>${escape(data.contractNumber)}</figcaption></figure>` : ''}<div class="journey">${ticketWorldMap}<span>Good<br>Journeys</span></div></footer><div class="ticket-note">${data.transferDirections.length ? `TRANSFER INCLUDED: ${escape(data.transferDirections.join(' / '))} · ` : ''}FLIGHT TIMES: TEHRAN TIME · PRESENCE 03:00 BEFORE FLIGHT TIME AT THE AIRPORT IS MANDATORY<br><span lang="fa" dir="rtl">حضور در فرودگاه ۳ ساعت قبل از پرواز الزامی است.</span></div></article>`;
}
export const ticketLayoutStyles = `
@page{size:A4 portrait;margin:0}
.flight-ticket .document-info{display:grid;grid-template-columns:.9fr 1.3fr 1.7fr 1.1fr;border:1px solid #dce6ee;border-radius:2mm;margin:0 0 4mm;padding:2.5mm 3mm;gap:3mm;min-height:15mm}.flight-ticket .document-info>div+div{border-left:1px solid #dce6ee;padding-left:3mm}.flight-ticket .document-info span{display:block;font-size:7pt;letter-spacing:.25mm;color:#5c758a;margin-bottom:1mm}.flight-ticket .document-info strong{display:block;min-height:4mm;font-size:8pt;line-height:1.3;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.flight-ticket,.flight-ticket *{box-sizing:border-box}.flight-ticket{position:relative;width:210mm;min-height:297mm;padding:7mm;color:#102e52;background:white;font-family:"Segoe UI",Arial,ReservationNazanin,sans-serif;line-height:1.15;page-break-after:always;isolation:isolate}.flight-ticket:last-child{page-break-after:auto}
.flight-ticket header{height:29mm;display:flex;align-items:flex-start;justify-content:space-between;gap:4mm}.flight-ticket h1{margin:1mm 0 2mm;font-size:31pt;font-weight:800;letter-spacing:.2mm;color:#071e44;white-space:nowrap}.flight-ticket header p{font-size:8.5pt;letter-spacing:1.3mm;margin:0;white-space:nowrap}.flight-ticket .logos{display:flex;align-items:center;justify-content:flex-end;flex-wrap:nowrap;gap:4mm;height:32mm;flex-shrink:0}.flight-ticket .airline-logo{width:34mm;height:32mm;object-fit:contain}.flight-ticket .agency-logo{width:32mm;height:32mm;object-fit:contain}.flight-ticket .airline-name{width:31mm;font-size:13pt;padding-top:8mm;overflow-wrap:anywhere}.flight-ticket .icon{width:8mm;height:8mm;flex-shrink:0}.flight-ticket .plane{fill:currentColor;stroke-width:.6}
.flight-ticket .identity{min-height:24mm;display:grid;grid-template-columns:1fr 1.12fr 18mm;align-items:center;gap:4mm;border-radius:3mm;background:linear-gradient(110deg,#f0f6fb,#eaf3fa);padding:3mm 6mm;margin-bottom:3mm}.flight-ticket .identity>div{display:flex;align-items:center;gap:5mm;min-width:0}.flight-ticket .identity>div+div{border-left:1px solid #c8d8e4;padding-left:6mm}.flight-ticket .identity i{display:grid;place-items:center;border:1px solid #193d61;border-radius:50%;width:15mm;height:15mm;flex-shrink:0}.flight-ticket .identity p{margin:0;min-width:0}.flight-ticket .identity span{display:block;font-size:8pt;margin-bottom:2mm}.flight-ticket .identity strong{display:block;font-size:12pt;color:#081e43;overflow-wrap:anywhere}.flight-ticket .identity small{font-size:5.5pt;line-height:2;letter-spacing:1mm;color:#7790a6}
.flight-ticket .leg{border:1px solid #dde7ef;border-radius:3mm;overflow:hidden;margin-bottom:4mm;break-inside:avoid;box-shadow:0 1mm 3mm #c8d9e533}.flight-ticket .leg-head{height:12mm;background:linear-gradient(110deg,#103456,#173e64);color:white;display:flex;align-items:center;gap:5mm;padding:2mm 6mm}.flight-ticket .leg.return .leg-head{background:linear-gradient(110deg,#088799,#0c90a0)}.flight-ticket .leg-head strong{font-size:13pt;letter-spacing:.2mm}.flight-ticket .leg-head>span{font-size:10.5pt;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.15mm;border-left:1px solid #93a8ba;padding-left:5mm}
.flight-ticket .route{position:relative;display:grid;grid-template-columns:1fr 1.55fr 1fr;align-items:center;gap:4mm;min-height:41mm;padding:3mm 20mm 3mm;isolation:isolate}.flight-ticket .place{display:flex;flex-direction:column;align-items:flex-start;min-width:0}.flight-ticket .city{font-size:10pt;font-weight:bold;text-transform:uppercase}.flight-ticket .airport-code{font-size:29pt;font-weight:800;color:#071e44;margin:.8mm 0}.flight-ticket .airport-name{font-size:7.5pt;max-width:35mm;min-height:7mm}.flight-ticket .clock{font-size:16pt;color:#081e43;margin-top:1.5mm}.flight-ticket .flight-date{font-size:10.5pt;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.15mm;margin-top:1.2mm}.flight-ticket .destination{align-self:start;padding-top:0}.flight-ticket .arrival{font-size:7pt;margin-top:4mm;line-height:1.4}.flight-ticket .landscape{position:absolute;width:43mm;height:32mm;bottom:0;left:0;z-index:-1;color:#d5e1ea;opacity:.5}.flight-ticket .destination-landscape{position:absolute;inset:0;z-index:-1;pointer-events:none}.flight-ticket .destination-landscape .landscape{left:auto;right:0}
.flight-ticket .flight-path{text-align:center;position:relative;padding-top:10mm;min-width:0}.flight-ticket .flight-path>svg{width:100%;height:15mm;display:block}.flight-ticket .path-plane{position:absolute;top:10mm;left:calc(50% - 4mm);transform:rotate(-5deg);color:#124361}.flight-ticket .path-plane .icon{width:10mm;height:10mm}.flight-ticket .flight-facts{display:flex;align-items:center;justify-content:center;gap:5mm;margin:1mm 0 2mm;font-size:8pt}.flight-ticket .flight-facts span+span{border-left:1px solid #567187;padding-left:5mm}.flight-ticket .route-label{display:block;font-size:8.5pt;letter-spacing:.5mm;text-transform:uppercase;overflow-wrap:anywhere}.flight-ticket .carrier{display:block;font-size:6.5pt;color:#648197;margin-top:2mm}
.flight-ticket .leg-foot{display:grid;grid-template-columns:repeat(3,1fr);background:#f6fafc;border-top:1px solid #e2ebf2;min-height:14mm;padding:2.5mm 9mm;gap:4mm}.flight-ticket .leg-foot>div{display:flex;align-items:center;gap:4mm}.flight-ticket .leg-foot>div+div{border-left:1px solid #c8d8e4;padding-left:8mm}.flight-ticket .leg-foot p{margin:0}.flight-ticket .leg-foot span{display:block;font-size:7.5pt;margin-bottom:1mm}.flight-ticket .leg-foot strong{font-size:9pt;color:#0b2245}
.flight-ticket footer{display:flex;justify-content:space-between;align-items:center;min-height:26mm;margin-top:1mm}.flight-ticket .ticket-qr{margin:0;padding:1mm;background:#f2f7fb;border-radius:2mm;width:25mm}.flight-ticket .ticket-qr svg{display:block;width:22mm;height:22mm}.flight-ticket .ticket-qr figcaption{font-size:5pt;text-align:center;overflow-wrap:anywhere}.flight-ticket .journey{position:relative;width:73mm;height:26mm}.flight-ticket .world{position:absolute;inset:0;width:100%;height:100%;color:#dce5eb;opacity:.85}.flight-ticket .journey span{position:absolute;right:2mm;bottom:1mm;color:#1396a5;font-family:"Segoe Script","Brush Script MT",cursive;font-style:italic;font-size:19pt;line-height:1;transform:rotate(-15deg);border-bottom:1px solid #1396a5;padding-bottom:2mm}.flight-ticket .ticket-note{font-size:8pt;font-weight:600;line-height:1.65;color:#244660;text-align:center;margin-top:2mm;padding:2mm 3mm;border-top:1px solid #d8e4ed}.ticket-note span{font-size:10pt;font-family:ReservationNazanin,"Segoe UI",sans-serif}.flight-ticket .draft{font-size:8pt;color:#a62d2d;border:1px dashed #a62d2d;text-align:center;padding:1mm;margin-bottom:2mm}
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
