import { describe, expect, it } from 'vitest';
import {
  accessibleRows,
  defaultQuery,
  queryRows,
  type RequestView,
} from './model';
import {
  reservationColumns,
  reservationCells,
  reservationExportRows,
} from './reservation-table';
import { createReservationXlsx } from './reservation-xlsx';
import { unzipWorkbook } from '@/modules/organizations/model/organization-xlsx';
const row = (id: string, branchId = 'allowed'): RequestView => ({
  id,
  branchId,
  contractNumber: id,
  branchName: '',
  issuerName: '',
  customerName: '',
  salesCounter: '',
  assignee: null,
  passengerNames: [],
  services: ['HOTEL'],
  priority: 'NORMAL',
  deadline: null,
  createdAt: '2026-09-09T10:00:00Z',
  status: 'NEW',
  issues: [],
});
describe('reservation table and workbook', () => {
  it('exports all matching authorized rows rather than only the displayed page', () => {
    const rows = Array.from({ length: 125 }, (_, index) =>
      row(`DEMO-${index}`),
    );
    rows.push(row('FOREIGN', 'other'), {
      ...row('CANCELLED'),
      status: 'CANCELLED',
    });
    const result = queryRows(
      accessibleRows(rows, {
        authenticated: true,
        permissions: ['reservations.read'],
        branchIds: ['allowed'],
      }),
      { ...defaultQuery, status: 'NEW', page: 2 },
    );
    expect(result.rows).toHaveLength(10);
    expect(result.filteredRows).toHaveLength(125);
    const exported = reservationExportRows(result.filteredRows);
    expect(exported).toHaveLength(126);
    expect(exported.flat()).not.toContain('FOREIGN');
    expect(exported.flat()).not.toContain('CANCELLED');
    expect(
      queryRows(rows, {
        ...defaultQuery,
        fromDate: '2026-09-10',
        toDate: '2026-09-09',
      }).filteredRows,
    ).toEqual([]);
  });
  it('preserves known zero counts, missing counts, Gregorian dates and real flags', () => {
    const cells = reservationCells({
      ...row('DEMO'),
      checkIn: '2026-09-09',
      singleRooms: 0,
      doubleRooms: 2,
      roomCount: 2,
      hotelRequested: true,
      hotelConfirmed: false,
    });
    expect(cells.slice(3, 11)).toEqual([
      '09/09/2026',
      '—',
      '0',
      '2',
      '—',
      '2',
      '✓',
      '—',
    ]);
  });
  it('writes an RTL filtered XLSX with a frozen header and untrusted text as literal strings', async () => {
    const bytes = createReservationXlsx(
      reservationExportRows([{ ...row('=1+1'), hotelName: 'Hotel & <Test>' }]),
    );
    const entries = await unzipWorkbook(bytes.buffer as ArrayBuffer);
    const xml = entries.get('xl/worksheets/sheet1.xml')!;
    expect(xml).toContain('rightToLeft="1"');
    expect(xml).toContain('state="frozen"');
    expect(xml).toContain('autoFilter ref="A1:AT2"');
    expect(xml).toContain('t="inlineStr"');
    expect(xml).toContain('=1+1');
    expect(xml).toContain('Hotel &amp; &lt;Test&gt;');
    expect(xml).not.toContain('<f>');
    expect(entries.get('xl/workbook.xml')).toContain('name="Reservations"');
  });
});

it('includes additional contract columns in the filtered workbook and keeps unknown values empty', () => {
  const exported = reservationExportRows([
    {
      ...row('QA'),
      salesCounter: 'Seller',
      customerName: 'Agency',
      serviceTitles: ['Flight', 'Hotel'],
      mealServiceName: 'UALL',
      hotelNotes: 'TWIN BED',
    },
  ]);
  expect(exported[0]!.slice(13, 17)).toEqual([
    'خدمات',
    'فروشنده',
    'طرف قرارداد',
    'سرویس هتل',
  ]);
  expect(exported[1]!.slice(13, 17)).toEqual([
    'Flight، Hotel',
    'Seller',
    'Agency',
    'UALL',
  ]);
  expect(reservationCells(row('EMPTY')).slice(14, 18)).toEqual([
    '—',
    '—',
    '—',
    '—',
  ]);
});

it('matches the exact column order, keeps ages/zero counts and independent currencies in export', () => {
  const fields = reservationColumns;
  expect(fields).toHaveLength(46);
  expect(fields.slice(8, 13)).toEqual([
    'تعداد اتاق',
    'اقدام هتل',
    'تأیید هتل',
    'اصلاح',
    'تاریخ اصلاح',
  ]);
  expect(fields.slice(28, 32)).toEqual([
    'اقدام ویزا',
    'تأیید ویزا',
    'اقدام پرواز',
    'تأیید پرواز',
  ]);
  expect(fields.slice(-4)).toEqual([
    'بدهکار ریالی',
    'بدهکاری ارزی',
    'ابطال',
    'تاریخ ابطال',
  ]);
  const summary = {
    createdAt: '2026-09-01T10:00:00Z',
    contractVersion: 4,
    correctedAt: '2026-09-20T10:00:00Z',
    cancelledAt: null,
    departureDate: '2026-10-01',
    returnDate: '2026-10-06',
    passengerCount: 4,
    adults: 1,
    children2To6: 1,
    children6To12: 1,
    infants: 1,
    saleRial: '900',
    saleForeign: '200 USD / 100 EUR',
    currencies: 'IRR / USD / EUR',
    discount: '100 IRR',
    commission: '3%',
    debtRial: '600',
    debtForeign: '200 USD / 100 EUR',
  };
  const cells = reservationCells({
    ...row('TEST'),
    tableSummary: summary,
    checkIn: '2026-10-01',
    checkOut: '2026-10-06',
    cost: '500 IRR / 150 USD',
    tableFlags: {
      visaRequested: {
        checked: true,
        updatedAt: '2026-09-20T10:00:00Z',
        updatedByUserId: 'user',
      },
    },
  });
  expect(cells.slice(19, 22)).toEqual(['6', '5', '4']);
  expect(cells.slice(24, 28)).toEqual(['1', '1', '1', '1']);
  expect(cells[28]).toBe('✓');
  expect(cells[32]).toBe('01/09/2026');
  expect(cells.slice(36, 44)).toEqual([
    '900',
    '200 USD / 100 EUR',
    'IRR / USD / EUR',
    '100 IRR',
    '3%',
    '500 IRR / 150 USD',
    '600',
    '200 USD / 100 EUR',
  ]);
});
