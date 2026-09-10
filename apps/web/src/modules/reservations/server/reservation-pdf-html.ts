import {
  reservationFormData,
  reservationPassengerPages,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from '../model/reservation-form';
const escape = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export function reservationPdfHtml(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
  logo: string,
  css: string,
) {
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo))
    throw new Error('PDF_LOGO_INVALID');
  const data = reservationFormData(intake, refs),
    pages = reservationPassengerPages(data.passengers);
  const heading = (n: string, title: string, note: string) =>
    `<div class="heading"><b>${n}</b><strong>${title}</strong><span>${note}</span></div>`;
  const fields = (items: unknown[][], cls: string) =>
    `<div class="${cls}">${items.map(([k, v]) => `<div><span>${escape(k)}</span><b dir="auto">${escape(v)}</b></div>`).join('')}</div>`;
  const table = (heads: string[], rows: unknown[][], extra = '') =>
    `<table class="table ${extra}"><thead><tr>${heads.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td dir="auto">${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  let first = 0;
  const sheets = pages
    .map((people, index) => {
      const rows = people.map((p, i) => [
        String(first + i + 1).padStart(2, '0'),
        p.name,
        p.sex,
        p.age,
      ]);
      first += people.length;
      return `<article class="page" dir="ltr"><header class="header"><div><h1>RESERVATION FORM</h1><p>TRAVEL SERVICES / HOTEL / TRANSFER / TOUR LEADER</p></div><div class="brand"><strong dir="auto">${escape(data.brand)}</strong><span>TOUR &amp; TRAVEL AGENCY</span></div><img class="logo" src="${logo}" alt=""/></header>
    ${fields(
      [
        ['REQUEST NO.', data.request],
        ['SUPPLIER', data.supplier],
        ['DATE OF ISSUE', data.issueDate],
        ['SERVICES', data.services],
      ],
      'meta',
    )}
    ${heading('01', 'BOOKING SUMMARY', 'Reservation details')}${fields(
      [
        ['ADULTS', data.adults],
        ['CHILDREN', data.children],
        ['INFANTS', data.infants],
        ['DESTINATION', data.destination],
        ['ROOMS / NIGHTS', `${data.rooms} ROOMS / ${data.nights} NIGHTS`],
        ['TOUR LEADER', data.leader],
      ],
      'summary',
    )}
    ${heading('02', 'FLIGHT INFORMATION', 'Departure & return · Tehran time')}${table(['LEG', 'AIRLINE', 'FLIGHT NO.', 'DATE', 'TIME'], data.flights.length ? data.flights.map((f) => [f.leg, f.airline, f.number, f.date, f.time]) : [['-', '-', '-', '-', '-']])}
    ${heading('03', 'HOTEL INFORMATION', 'Accommodation')}${table(
      ['HOTEL', 'CITY', 'STAR', 'SERVICE', 'ROOM TYPE'],
      [
        [data.hotel, data.destination, data.stars, data.meal, data.roomType],
        ['CHECK-IN', 'CHECK-OUT', 'DBL', 'SGL', 'EXT'],
        [data.checkIn, data.checkOut, data.double, data.single, data.extra],
      ],
    )}
    ${heading('04', 'TOUR SERVICES', 'Leader & excursion')}${table(['TOUR LEADER', 'EXCURSION'], [[data.leader, data.excursion]])}
    ${heading('05', 'PASSENGERS', 'Passenger MANIFEST')}${table(['#', 'SURNAME / NAME', 'SEX', 'AGE RATE'], rows.length ? rows : [['-', '-', '-', '-']], 'passengers')}
    ${heading('06', 'NOTICE', 'Notes & confirmation')}<div class="notice"><span>SPECIAL REQUESTS / REMARKS</span><p dir="auto">${escape(data.notes) || '&nbsp;'}</p><div></div></div>
    <footer class="footer"><div><strong dir="auto">${escape(data.brand)}</strong><span>Reservation request - subject to supplier confirmation.</span></div><b>${index + 1} / ${pages.length}</b></footer></article>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><title>${escape(data.request)}</title><style>${css}\n@page{size:A4;margin:0}html,body{margin:0;padding:0}.page{margin:0;break-after:page}.page:last-child{break-after:auto}.passengers th:nth-child(2){width:56%}</style></head><body>${sheets}</body></html>`;
}
