import { supplierPriceTableData } from '../model/supplier-form-prices';
import { voucherPdfHtml } from './voucher-pdf-html';
import { reservationFormFooterHtml } from '../model/reservation-form-footer';

import { supplierFormData, voucherFormData } from '../model/voucher-settings';
import {
  reservationPassengerPages,
  reservationRoomAppendices,
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
  voucher = false,
  origin = '',
  publicDocumentUrl?: string,
) {
  if (voucher)
    return voucherPdfHtml(
      intake,
      refs,
      logo,
      css,
      true,
      origin,
      publicDocumentUrl,
    );
  const settings = voucher
    ? intake.workflow.voucherSettings
    : intake.workflow.supplierFormSettings;
  const withLetterhead = settings?.flags.withLetterhead !== false;
  if (
    withLetterhead &&
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)
  )
    throw new Error('PDF_LOGO_INVALID');
  const data = voucher
    ? voucherFormData(intake, refs)
    : supplierFormData(intake, refs);
  const pages = voucher
    ? reservationPassengerPages(
        data.passengers,
        settings
          ? Math.max(
              6,
              8 - Math.ceil(Object.values(settings.text).join('').length / 350),
            )
          : 10,
      )
    : [data.passengers];
  const heading = (n: string, title: string, note: string) =>
    `<div class="heading"><b>${n}</b><strong>${title}</strong><span>${note}</span></div>`;
  const fields = (items: unknown[][], cls: string) =>
    `<div class="${cls}">${items.map(([k, v]) => `<div${k === 'ROOMS / NIGHTS' ? ' class="roomsNights"' : ''}><span>${escape(k)}</span><b dir="auto">${escape(v)}</b></div>`).join('')}</div>`;
  const table = (
    heads: string[],
    rows: unknown[][],
    extra = '',
    different: readonly boolean[] = [],
  ) =>
    `<table class="table ${extra}"><thead><tr>${heads.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, rowIndex) => `<tr>${r.map((v, cellIndex) => `<td${different[rowIndex] && ['CHECK-IN', 'CHECK-OUT'].includes(heads[cellIndex] ?? '') ? ' class="differentStay"' : ''} dir="auto">${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const roomAppendices =
    voucher && (!settings || settings.flags.hotel)
      ? reservationRoomAppendices(data.roomBreakdown)
      : [];
  const pageCount = pages.length + roomAppendices.length;
  let first = 0;
  const sheets = pages
    .map((people, index) => {
      const rows = people.map((p, i) => {
        return [
          String(first + i + 1).padStart(2, '0'),
          p.name,
          p.sex,
          p.age === 'CHD (2-6)'
            ? 'CHD 2-6'
            : p.age === 'CHD (6-12)'
              ? 'CHD 6-12'
              : p.age,
          ...(!voucher
            ? [
                p.outboundFlight ? '✓' : '-',
                p.returnFlight ? '✓' : '-',
                p.checkIn ?? '-',
                p.checkOut ?? '-',
                p.outboundTransfer ? '✓' : '-',
                p.returnTransfer ? '✓' : '-',
                p.otherServices,
              ]
            : []),
          ...(voucher && data.passengers.some((p) => p.checkIn !== undefined)
            ? [p.checkIn ?? '—', p.checkOut ?? '—']
            : []),
        ];
      });
      first += people.length;
      return `<article class="page" dir="ltr" lang="en"><header class="${withLetterhead ? 'header' : 'plainHeader'}"><div><h1>${voucher ? 'HOTEL VOUCHER' : intake.supplierDocumentKind && intake.supplierDocumentKind !== 'HOTEL' ? 'TRANSFER FORM' : 'RESERVATION FORM'}</h1><p>TRAVEL SERVICES / HOTEL / TRANSFER / TOUR LEADER</p></div><div class="brand${intake.workflow.branding?.kind === 'OWN' && intake.workflow.branding.companyCode === 'JAHAN_BASTAN' ? ' jahanBrand' : ''}">${withLetterhead ? `<img class="${intake.workflow.branding?.kind === 'OWN' ? (intake.workflow.branding.companyCode === 'JAHAN_BASTAN' ? 'jahanLogo' : 'logo') : 'agencyLogo'}" src="${logo}" alt=""/>` : ''}</div></header>
    ${fields(
      [
        [voucher ? 'BOOKING NO.' : 'REQUEST NO.', data.request],
        ['SUPPLIER', data.supplier],

        [voucher ? 'BOOKING DATE' : 'DATE OF ISSUE', data.issueDate],
        ['SERVICES', data.services],
      ],
      'meta',
    )}
    <section class="bookingSection">${heading('01', 'BOOKING SUMMARY', 'Reservation details')}${fields(
      [
        ['ADULTS', data.adults],
        ['CHILDREN 6-12', data.children6To12],
        ['CHILDREN 2-6', data.children2To6],
        ...(data.childrenUnclassified
          ? [['CHILDREN (UNSPECIFIED)', data.childrenUnclassified]]
          : []),
        ['INFANTS', data.infants],
        ['DESTINATION', data.destination],
        ['ROOMS / NIGHTS', `${data.rooms} ROOMS / ${data.nights} NIGHTS`],
      ],
      'summary',
    )}
    </section>
    ${
      settings?.flags.hotel === false
        ? ''
        : `    ${heading('03', 'HOTEL INFORMATION', 'Accommodation')}${table(
            [
              'HOTEL',
              'CITY',
              'STAR',
              'SERVICE',
              ...(!data.roomBreakdown.length ? ['ROOM TYPE'] : []),
            ],
            [
              [
                data.hotel,
                data.destination,
                data.stars,
                data.meal,
                ...(!data.roomBreakdown.length ? [data.roomType] : []),
              ],
            ],
            'hotelInformation',
          )}
    ${
      data.roomBreakdown.length
        ? table(
            ['ROOM', 'ROOM TYPE', 'ADULTS', 'CHILD AGES', 'GUESTS'],
            data.roomBreakdown
              .slice(0, voucher ? 4 : undefined)
              .map((r) => [
                r.ordinal,
                r.roomType,
                r.adults,
                r.childAges.join(', ') || '-',
                r.adults + r.childAges.length,
              ]),
            'roomBreakdown',
          ).replace(
            '<thead>',
            '<caption>ROOM QUANTITIES BY TYPE</caption><thead>',
          )
        : ''
    }
    <table class="table"><tbody><tr><th>CHECK-IN</th><td>${escape(data.checkIn)}</td><th>CHECK-OUT</th><td>${escape(data.checkOut)}</td></tr></tbody></table>
`
    }
    ${
      intake.snapshot.serviceSelections.some((s) => s.kind === 'TRANSFER')
        ? heading('03A', 'FLIGHT INFORMATION', 'Arrival & departure') +
          table(
            ['DIRECTION', 'AIRLINE', 'FLIGHT', 'DATE', 'TIME'],
            data.flights.map((flight) => [
              flight.leg,
              flight.airline,
              flight.number,
              flight.date,
              flight.time,
            ]),
          )
        : ''
    }
    ${heading('04', 'TOUR SERVICES', 'Leader & excursion')}${table(['TRANSFER', 'TOUR LEADER', 'EXCURSION'], [[voucher ? data.transfer + ' · Board: ' + (settings?.text.transferBoard?.trim() || '-') : data.transfer, data.leader, data.excursion]])}
    ${heading('05', 'PASSENGERS', 'Passenger services')}${table(
      [
        '#',
        'SURNAME / NAME',
        'SEX',
        'AGE RATE',
        ...(!voucher
          ? [
              'FLIGHT OUT',
              'FLIGHT BACK',
              'CHECK-IN',
              'CHECK-OUT',
              'TRF IN',
              'TRF OUT',
              'OTHER SERVICES',
            ]
          : []),
        ...(voucher && data.passengers.some((p) => p.checkIn !== undefined)
          ? ['CHECK-IN', 'CHECK-OUT']
          : []),
      ],
      rows.length
        ? rows
        : [
            [
              data.contractPartyName ? 'CONTRACT PARTY' : '-',
              data.contractPartyName || '-',
              '-',
              '-',
              ...Array(7).fill('-'),
            ],
          ],
      'passengers',
      people.map((p) => p.differentStay === true),
    )}
    ${!voucher ? heading('06', 'PRICES', 'Supplier quotation') + table(supplierPriceTableData(intake).headers, supplierPriceTableData(intake).rows) : ''}${heading(voucher ? '06' : '07', 'NOTICE', 'Notes & confirmation')}<div class="notice"><span>SPECIAL REQUESTS / REMARKS</span><p dir="auto">${escape(data.notes) || '&nbsp;'}</p><div></div></div>${voucher ? '<div class="stamp"><strong>STAMP</strong></div>' : ''}
    <footer class="footer"><div data-reservation-footer>${reservationFormFooterHtml(intake.id, origin, intake.workflow.branding?.companyCode, data.brand, publicDocumentUrl)}</div><div><span></span></div>${voucher ? `<b>${index + 1} / ${pageCount}</b>` : ''}</footer></article>`;
    })
    .join('');
  const appendices = roomAppendices
    .map(
      (rooms, index) =>
        `<article class="page" dir="ltr" data-reservation-form-page><header class="header"><h1>ROOM DETAILS</h1></header><p>${escape(data.request)} · ${escape(data.hotel)} · ${escape(data.checkIn)} / ${escape(data.checkOut)}</p>${table(
          ['ROOM', 'ROOM TYPE', 'ADULTS', 'CHILD AGES', 'GUESTS'],
          rooms.map((r) => [
            r.ordinal,
            r.roomType,
            r.adults,
            r.childAges.join(', ') || '-',
            r.adults + r.childAges.length,
          ]),
        )}<footer class="footer"><b>${pages.length + index + 1} / ${pageCount}</b></footer></article>`,
    )
    .join('');
  const supplierFooter = !voucher
    ? (sheets.match(/<footer class="footer">[\s\S]*?<\/footer>/)?.[0] ?? '')
    : '';
  const content = voucher
    ? sheets
    : sheets.replace(/<footer class="footer">[\s\S]*?<\/footer>/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><title>${escape(data.request)}</title><style>${css}\n@page{size:A4;margin:0}html,body{margin:0;padding:0}.page{margin:0;break-after:page}.page:last-child{break-after:auto}.passengers th:nth-child(2){width:${voucher ? '56%' : '20%'}}${voucher ? '' : '@page reservationSupplier{size:A4;margin:8.5mm;@bottom-right{content:counter(page) " / " counter(pages);font:8pt Arial}}[data-supplier-form]{page:reservationSupplier}@media print{[data-supplier-form] .page{padding:0;min-height:0;width:auto;break-after:auto}[data-supplier-form] .footer{position:fixed;height:26mm;display:block;bottom:0;left:0;right:0;margin:0;padding-top:2mm;font:9px Arial;break-inside:auto;z-index:10;background:white}.pagination{width:100%;border-collapse:collapse}.pagination>tbody>tr>td{padding:0}.pagination>tfoot{display:table-footer-group}.pagination>tbody>tr{break-inside:auto}.pagination>tfoot tr{break-inside:avoid}.pagination>tfoot td{height:30mm;padding:0}[data-supplier-form] .footer>[data-reservation-footer]{position:absolute;top:2mm;left:0;right:0;height:24mm;display:block}[data-supplier-form] [data-reservation-contact]{position:absolute;top:4mm;left:0;line-height:1.3;display:block}[data-supplier-form] [data-reservation-qr]{position:absolute;top:0;right:0}}'}</style></head><body${voucher ? '' : ' data-supplier-form'}>${voucher ? content + appendices : `<table class="pagination"><tbody><tr><td>${content}</td></tr></tbody><tfoot><tr><td>&nbsp;</td></tr></tfoot></table>${supplierFooter}`}</body></html>`;
}
