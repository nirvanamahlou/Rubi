import type { FlightTicketSheetData } from '@/modules/sales/public/tickets';

type Ticket = FlightTicketSheetData & { passengerId: string };

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const date = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));

export function ticketPdfHtml(
  tickets: readonly Ticket[],
  cityNames: Readonly<Record<string, string>>,
  branding: { name: string; logoDataUrl: string },
) {
  if (!tickets.length) throw new Error('TICKET_DATA_MISSING');
  if (
    !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
      branding.logoDataUrl,
    )
  )
    throw new Error('TICKET_LOGO_INVALID');
  const city = (id: string) => cityNames[id] || '—';
  const pages = tickets
    .map((ticket) => {
      const airlines = [
        ...new Set(ticket.offers.map((item) => item.carrierName)),
      ]
        .map(escapeHtml)
        .join(' / ');
      const rows = ticket.offers
        .map(
          (offer) => `<tr>
<td>${escapeHtml(date(offer.departureAt))}</td>
<td>${escapeHtml(offer.serviceNumber)}</td>
<td>${escapeHtml(city(offer.originId))}</td>
<td>${escapeHtml(city(offer.destinationId))}</td>
<td>${escapeHtml(time(offer.departureAt))}</td>
<td>${escapeHtml(offer.businessOutput ? 'BUSINESS' : offer.cabinClassCode)}</td>
<td>ISSUED</td>
<td>—</td>
</tr>`,
        )
        .join('');
      return `<article class="ticket">
<header><div><h1>FLIGHT TICKET</h1><i></i></div><img src="${branding.logoDataUrl}" alt="${escapeHtml(branding.name)}"></header>
<h2>${airlines || 'AIRLINE'}</h2>
<section class="identity"><div>Agency Name<strong>${escapeHtml(branding.name)}</strong></div><div>Passenger Name<strong>${escapeHtml(ticket.passengerName)}</strong></div><div>Contract<strong>${escapeHtml(ticket.contractNumber || '—')}</strong></div></section>
${ticket.transferDirections.length ? `<p class="transfer">TRANSFER INCLUDED: <strong>${escapeHtml(ticket.transferDirections.join(' / '))}</strong></p>` : ''}
<section class="flight"><h3><b>1</b> FLIGHT INFORMATION</h3><table><thead><tr><th>Date</th><th>Flight No</th><th>Departure</th><th>Arrival</th><th>Time</th><th>Class</th><th>Status</th><th>Bag</th></tr></thead><tbody>${rows}</tbody></table></section>
</article>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#07164b;font-family:Arial,ReservationNazanin,sans-serif}.ticket{width:210mm;min-height:297mm;padding:12mm 10mm;border:1.5mm solid #07164b;border-top:4mm solid #173d7a;border-bottom:5mm solid #07164b;page-break-after:always}.ticket:last-child{page-break-after:auto}header{display:flex;align-items:center;justify-content:space-between;gap:8mm}h1{font-size:28pt;margin:0}header i{display:block;width:38mm;height:1mm;margin-top:4mm;background:#173d7a}header img{width:50mm;height:28mm;object-fit:contain}h2{text-align:center;font-size:18pt;margin:6mm 0}.identity{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;font-size:9pt}.identity strong{display:block;margin-top:1.5mm;color:#111827}.transfer{font-size:9pt}.flight{position:relative;border:1px solid #07164b;border-radius:3mm;margin-top:10mm;padding:7mm 3mm 3mm}.flight h3{position:absolute;left:-1px;top:-7mm;margin:0;padding:2mm 5mm 2mm 0;border-radius:2mm 5mm 5mm 0;background:#07164b;color:#fff;font-size:9pt}.flight h3 b{padding:2.2mm 3mm;margin-right:2mm;border-radius:2mm 0 3mm 0;background:#173d7a}table{width:100%;border-collapse:collapse;font-size:7.5pt}th{padding:2.5mm 1mm;background:#173d7a;color:#fff}td{padding:2.5mm 1mm;text-align:center;border:1px dashed #c4c8cd;color:#111827}
</style></head><body>${pages}</body></html>`;
}
