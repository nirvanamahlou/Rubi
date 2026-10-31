import { supplierPriceTableData } from '../model/supplier-form-prices';
import { localizeDocumentHtml } from '@/i18n/document';
import {
  voucherPassengerServices,
  voucherPassengerCells,
  voucherServiceColumns,
  voucherPassengerPageUnits,
} from '../model/voucher-passenger-services';
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
export function voucherPdfHtml(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
  logo: string,
  css: string,
  voucher = false,
  origin = '',
  publicDocumentUrl?: string,
) {
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
  const passengerServices: ReturnType<typeof voucherPassengerServices> = voucher
    ? voucherPassengerServices(intake, data)
    : {};
  const pages = voucher
    ? reservationPassengerPages(
        data.passengers,
        voucherPassengerPageUnits(settings, data.notes),
      )
    : [data.passengers];
  const heading = (n: string, title: string, note: string) =>
    `<div class="heading"><b>${n}</b><strong>${title}</strong><span>${note}</span></div>`;
  const fields = (items: unknown[][], cls: string) =>
    `<div class="${cls}">${items.map(([k, v]) => `<div><span>${escape(k)}</span><b dir="auto">${escape(v)}</b></div>`).join('')}</div>`;
  const table = (
    heads: string[],
    rows: unknown[][],
    extra = '',
    different: boolean[] = [],
  ) =>
    `<table class="table ${extra}"><thead><tr>${heads.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, row) => `<tr>${r.map((v, column) => `<td${different[row] && [6, 7].includes(column) ? ' class="differentStay"' : ''} dir="auto">${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const roomAppendices =
    !settings || settings.flags.hotel
      ? reservationRoomAppendices(data.roomBreakdown)
      : [];
  const pageCount = pages.length + roomAppendices.length;
  let first = 0;
  const sheets = pages
    .map((people, index) => {
      const rows = people.map((p, i) => {
        if (voucher)
          return voucherPassengerCells(
            p,
            passengerServices[p.id]!,
            first + i + 1,
          );
        return [
          String(first + i + 1).padStart(2, '0'),
          p.name,
          p.sex,
          p.age === 'CHD (2-6)'
            ? 'CHD 2-6'
            : p.age === 'CHD (6-12)'
              ? 'CHD 6-12'
              : p.age,
          ...(data.passengers.some((p) => p.checkIn !== undefined)
            ? [p.checkIn ?? '—', p.checkOut ?? '—']
            : []),
        ];
      });
      first += people.length;
      return `<article class="page" ${voucher ? 'data-voucher' : ''} dir="ltr"><header class="${withLetterhead ? 'header' : 'plainHeader'}"><div><h1>${voucher ? 'HOTEL VOUCHER' : 'RESERVATION FORM'}</h1><p>TRAVEL SERVICES / HOTEL / TRANSFER / TOUR LEADER</p></div><div class="brand${intake.workflow.branding?.kind === 'OWN' && intake.workflow.branding.companyCode === 'JAHAN_BASTAN' ? ' jahanBrand' : ''}">${withLetterhead ? `<img class="${intake.workflow.branding?.kind === 'OWN' ? (intake.workflow.branding.companyCode === 'JAHAN_BASTAN' ? 'jahanLogo' : 'logo') : 'agencyLogo'}" src="${logo}" alt=""/>` : ''}</div></header>
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
    </section>${heading('02', 'FLIGHT INFORMATION', 'Departure & return · Tehran time')}${table(['AIRLINE', 'FLIGHT NO.', 'DATE', 'TIME'], data.flights.length ? data.flights.map((f) => [f.airline, f.number, f.date, f.time]) : [['-', '-', '-', '-']])}
    ${heading('03', 'HOTEL INFORMATION', 'Accommodation')}${table(
      [
        'HOTEL',
        'CITY',
        'STAR',
        'SERVICE',
        ...(!data.roomBreakdown.length ? ['ROOM TYPE'] : []),
        'CHECK-IN',
        'CHECK-OUT',
      ],
      [
        [
          data.hotel,
          data.destination,
          data.stars,
          data.meal,
          ...(!data.roomBreakdown.length ? [data.roomType] : []),
          data.checkIn,
          data.checkOut,
        ],
      ],
    )}
    ${
      data.roomBreakdown.length
        ? table(
            ['ROOM', 'ROOM TYPE', 'ADULTS', 'CHILD AGES', 'GUESTS'],
            data.roomBreakdown
              .slice(0, 4)
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
    ${heading('04', 'TOUR SERVICES', 'Leader & board')}${table(['TRANSFER', 'TOUR LEADER', 'BOARD'], [[data.transfer, data.leader, settings?.text.transferBoard?.trim() || '-']])}
    ${heading('05', voucher ? 'PASSENGER SERVICES' : 'PASSENGERS', 'Passenger manifest')}${
      voucher
        ? table(
            voucherServiceColumns.map((c) => c[0]),
            rows.length ? rows : [voucherServiceColumns.map(() => '—')],
            'voucherServices',
            people.map((p) => passengerServices[p.id]!.different),
          ).replace(
            '<thead>',
            '<colgroup>' +
              voucherServiceColumns
                .map((c) => '<col style="width:' + c[1] + '%">')
                .join('') +
              '</colgroup><thead>',
          )
        : table(
            [
              '#',
              'SURNAME / NAME',
              'SEX',
              'AGE RATE',
              ...(data.passengers.some((p) => p.checkIn !== undefined)
                ? ['CHECK-IN', 'CHECK-OUT']
                : []),
            ],
            rows.length ? rows : [['-', '-', '-', '-']],
            'passengers',
          )
    }
    ${!voucher ? heading('06', 'PRICES', 'Supplier quotation') + table(supplierPriceTableData(intake).headers, supplierPriceTableData(intake).rows) : ''}${heading(voucher ? '06' : '07', 'NOTICE', 'Notes & confirmation')}<div class="notice"><span>SPECIAL REQUESTS / REMARKS</span><p dir="auto">${escape(data.notes) || '&nbsp;'}</p><div></div></div>${voucher ? '<div class="stamp"><strong>STAMP</strong></div>' : ''}
    <footer class="footer"><div data-reservation-footer>${reservationFormFooterHtml(intake.id, origin, intake.workflow.branding?.companyCode, data.brand, publicDocumentUrl, voucher)}</div><div><span></span></div><b>${index + 1} / ${pageCount}</b></footer></article>`;
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
  const html = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><title>${escape(data.request)}</title><style>${css}\n@page{size:A4;margin:0}html,body{margin:0;padding:0}.page{margin:0;break-after:page}.page:last-child{break-after:auto}.passengers th:nth-child(2){width:56%}</style></head><body>${sheets}${appendices}</body></html>`;
  return voucher ? localizeDocumentHtml(html, 'en') : html;
}
