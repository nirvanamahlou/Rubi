import { describe, expect, it } from 'vitest';
import {
  accessibleRows,
  defaultQuery,
  queryRows,
  type RequestView,
} from './model';
import { reservationCells, reservationExportRows } from './reservation-table';
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
  it('preserves known zero counts, missing suites, Gregorian dates and real flags', () => {
    const cells = reservationCells({
      ...row('DEMO'),
      checkIn: '2026-09-09',
      singleRooms: 0,
      doubleRooms: 2,
      roomCount: 2,
      hotelRequested: true,
      hotelConfirmed: false,
    });
    expect(cells.slice(3, 12)).toEqual([
      '09/09/2026',
      '—',
      '0',
      '2',
      '—',
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
    expect(xml).toContain('autoFilter ref="A1:T2"');
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
  expect(exported[0]!.slice(14, 19)).toEqual([
    'خدمات',
    'فروشنده',
    'طرف قرارداد',
    'سرویس هتل',
    'توضیحات هتل',
  ]);
  expect(exported[1]!.slice(14, 19)).toEqual([
    'Flight، Hotel',
    'Seller',
    'Agency',
    'UALL',
    'TWIN BED',
  ]);
  expect(reservationCells(row('EMPTY')).slice(15, 19)).toEqual([
    '—',
    '—',
    '—',
    '—',
  ]);
});
