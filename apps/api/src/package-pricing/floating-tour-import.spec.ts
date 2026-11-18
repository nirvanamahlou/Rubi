import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, zipSync, unzipSync } from 'fflate';
import {
  floatingDate,
  floatingPrices,
  parseFloatingRows,
  readFloatingWorkbook,
  type FloatingCell,
} from './floating-tour-import';
import type { TourPackageInputV1 } from '@nora/contracts';
import { buildFloatingTourTemplate } from './floating-tour-template';
const c = (value: string, format = '', numeric = false): FloatingCell => ({
  value,
  format,
  numeric,
});
const headers = [
  'departure_date',
  'hotel_name',
  'loc',
  'room',
  'service',
  'DBL',
  'SGL',
  'CHD W BED',
  'child no bed',
  'infant',
  'flight per person',
  'flight child w bed',
  'EXTRA',
];
const book = (overrides: Record<string, string> = {}) => [
  headers.map((h) => c(h)),
  headers.map((h) =>
    c(
      (
        {
          departure_date: '1405/05/10',
          hotel_name: '  HOTEL   ONE ',
          room: 'Standard',
          service: '5* UALL',
          DBL: '€300',
          'flight per person': '50000000',
          ...overrides,
        } as Record<string, string>
      )[h] ?? '',
    ),
  ),
];
const tour = {
  originId: 'origin',
  destinationId: 'city',
  hotelIds: [],
  name: 'Test',
  transferOutbound: false,
  transferReturn: false,
  visa: false,
  details: { version: 1, isFloating: true },
} satisfies TourPackageInputV1;
const hotels = [{ id: 'h1', name: 'Hotel One', cityId: 'city' }];
const options = { nights: 7, mode: 'DATED' as const };
it('reads the actual customer template, keeping guide content out of data', () => {
  expect(
    readFloatingWorkbook(
      readFileSync('../web/public/templates/floating-tour-price.xlsx'),
    )[0]?.map((v) => v.value),
  ).toEqual(headers);
});
it('keeps DBL per person, combines currencies, and does not invent blank groups', () => {
  const row = parseFloatingRows(book(), options, tour, hotels)[0]!;
  expect(row.prices.double).toEqual([
    { currency: 'EUR', amount: '300' },
    { currency: 'IRR', amount: '500000000' },
  ]);
  expect(row.prices.single).toBeUndefined();
  expect(row.prices.infant).toBeUndefined();
  expect(row.stays[0]?.service).toBe('UALL');
  expect(row.stays[0]?.room).toBe('Standard');
  expect(row.startsOn).toBe('2026-08-01');
  expect(row.endsOn).toBe('2026-08-08');
});
it('handles child flight fallback, Toman no-bed totals, foreign no-bed and mixed infant totals', () => {
  const p = floatingPrices({
    'chd w bed': c('€200'),
    'child no bed': c('1000000'),
    infant: c('€20 + 5000000'),
    'flight per person': c('50000000'),
    'flight child w bed': c('30000000'),
  }).prices;
  expect(p.childBed).toEqual([
    { currency: 'EUR', amount: '200' },
    { currency: 'IRR', amount: '300000000' },
  ]);
  expect(p.childNoBed).toEqual([{ currency: 'IRR', amount: '10000000' }]);
  expect(p.infant).toEqual([
    { currency: 'EUR', amount: '20' },
    { currency: 'IRR', amount: '50000000' },
  ]);
  expect(
    floatingPrices({ 'child no bed': c('€20'), 'flight per person': c('100') })
      .prices.childNoBed,
  ).toEqual([
    { currency: 'EUR', amount: '20' },
    { currency: 'IRR', amount: '1000' },
  ]);
});
it('detects formatted currencies and rejects mixed foreign currencies, negative prices and empty groups', () => {
  expect(
    floatingPrices({
      dbl: c('300', '[$€-407]#,##0.00', true),
      'flight per person': c('20', '"€"0', true),
    }).prices.double,
  ).toEqual([{ currency: 'EUR', amount: '320' }]);
  expect(() => floatingPrices({ dbl: c('$100'), sgl: c('€100') })).toThrow();
  expect(() => floatingPrices({ 'flight per person': c('100') })).toThrow();
  expect(() => floatingPrices({ dbl: c('-20') })).toThrow();
});
it('requires unique registered hotels and date-room entries and only preserves an unambiguous previous room', () => {
  expect(() => parseFloatingRows(book(), options, tour, [])).toThrow();
  expect(() =>
    parseFloatingRows(book(), options, tour, [
      ...hotels,
      { ...hotels[0]!, id: 'h2' },
    ]),
  ).toThrow();
  expect(() =>
    parseFloatingRows([...book(), book()[1]!], options, tour, hotels),
  ).toThrow();
  expect(() =>
    parseFloatingRows(book({ room: '' }), options, tour, hotels),
  ).toThrow();
  const old = parseFloatingRows(book(), options, tour, hotels);
  expect(
    parseFloatingRows(book({ room: '' }), options, tour, hotels, old)[0]
      ?.stays[0]?.room,
  ).toBe('Standard');
});
it('ignores dates for monthly prices and retains the selected night count', () => {
  const row = parseFloatingRows(
    book({ departure_date: '' }),
    { ...options, mode: 'MONTHLY', calendar: 'PERSIAN', months: [8, 9] },
    tour,
    hotels,
  )[0]!;
  expect(row.startsOn).toBeNull();
  expect(row.endsOn).toBeNull();
  expect(row.nights).toBe(7);
});
it('pairs two hotels once without doubling package price', () => {
  const b = book();
  b.push(book({ hotel_name: 'Hotel Two' })[1]!);
  const combinedTour = {
    ...tour,
    details: {
      ...tour.details,
      isCombined: true,
      destinations: [
        { cityId: 'city', nights: 4 },
        { cityId: 'city2', nights: 3 },
      ],
    },
  };
  const rows = parseFloatingRows(
    b,
    { ...options, combined: true },
    combinedTour,
    [...hotels, { id: 'h2', name: 'Hotel Two', cityId: 'city2' }],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.stays.map((s) => s.nights)).toEqual([4, 3]);
  expect(rows[0]?.prices.double?.[0]?.amount).toBe('300');
  expect(() =>
    parseFloatingRows(
      book(),
      { ...options, combined: true },
      combinedTour,
      hotels,
    ),
  ).toThrow();
});
it('validates Persian and Gregorian dates and reads Excel serial dates', () => {
  expect(() => floatingDate(c('1405/12/30'))).toThrow();
  expect(() => floatingDate(c('2026-02-30'))).toThrow();
  expect(floatingDate(c('2026-08-01'))).toBe('2026-08-01');
  expect(floatingDate(c('46235', '', true))).toBe('2026-08-01');
});
it('rejects formulas, external data and ZIP expansion overflow', () => {
  const original = unzipSync(
    readFileSync('../web/public/templates/floating-tour-price.xlsx'),
  );
  expect(() =>
    readFloatingWorkbook(
      zipSync({
        ...original,
        'xl/externalLinks/externalLink1.xml': strToU8('<x/>'),
      }),
    ),
  ).toThrow();
  expect(() =>
    readFloatingWorkbook(
      zipSync({
        ...original,
        'xl/worksheets/sheet1.xml': strToU8(
          '<worksheet><row><c r="A1"><f>WEBSERVICE()</f><v>1</v></c></row></worksheet>',
        ),
      }),
    ),
  ).toThrow();
  expect(() =>
    readFloatingWorkbook(
      zipSync({
        ...original,
        'xl/large.xml': new Uint8Array(21 * 1024 * 1024),
      }),
    ),
  ).toThrow();
});

it('reads the dedicated combined template with separate nights and per-group flight switches', () => {
  const source = readFloatingWorkbook(
    readFileSync('../web/public/templates/floating-tour-combined.xlsx'),
  );
  const row: Record<string, string> = {
    departure_date: '2026-08-01',
    hotel_name_1: 'Hotel One',
    hotel_name_2: 'Hotel Two',
    nights_1: '4',
    nights_2: '3',
    room_1: 'Standard',
    room_2: 'Suite',
    service_1: 'UALL',
    service_2: 'ALL',
    dbl: '€300',
    sgl: '€500',
    'flight per person': '1000000',
    add_flight_dbl: 'NO',
    add_flight_sgl: 'YES',
  };
  const b = [
    source[0]!,
    source[0]!.map((h) => c(row[h.value.toLowerCase()] ?? '')),
  ];
  const combined = {
    ...tour,
    details: {
      ...tour.details,
      isCombined: true,
      destinations: [
        { cityId: 'city', nights: 4 },
        { cityId: 'city2', nights: 3 },
      ],
    },
  };
  const result = parseFloatingRows(
    b,
    { ...options, combined: true },
    combined,
    [...hotels, { id: 'h2', name: 'Hotel Two', cityId: 'city2' }],
  );
  expect(result).toHaveLength(1);
  expect(result[0]?.stays.map((s) => [s.nights, s.room, s.service])).toEqual([
    [4, 'Standard', 'UALL'],
    [3, 'Suite', 'ALL'],
  ]);
  expect(result[0]?.prices.double).toEqual([
    { currency: 'EUR', amount: '300' },
  ]);
  expect(result[0]?.prices.single).toEqual([
    { currency: 'EUR', amount: '500' },
    { currency: 'IRR', amount: '10000000' },
  ]);
});
it('stores commission separately and never subtracts it from sale prices', () => {
  const result = floatingPrices({ dbl: c('100'), commission: c('10') });
  expect(result.prices.double).toEqual([{ currency: 'IRR', amount: '1000' }]);
  expect(result.commission).toEqual([{ currency: 'IRR', amount: '100' }]);
});

const threeStopTour: TourPackageInputV1 = {
  ...tour,
  details: {
    ...tour.details,
    isCombined: true,
    destinations: [
      { cityId: 'city', nights: 2 },
      { cityId: 'city2', nights: 3 },
      { cityId: 'city3', nights: 2 },
    ],
  },
};
const threeHotels = [
  ...hotels,
  { id: 'h2', name: 'Hotel Two', cityId: 'city2' },
  { id: 'h3', name: 'Hotel Three', cityId: 'city3' },
];
function mergedWorkbook(
  changes: Record<string, string> = {},
  transform = (sheet: string) => sheet,
) {
  const files = unzipSync(buildFloatingTourTemplate(threeStopTour));
  const values: Record<string, string> = {
    A2: '2027-01-12',
    B2: 'Hotel One',
    B3: 'Hotel Two',
    B4: 'Hotel Three',
    D2: 'Standard',
    D3: 'Suite',
    D4: 'Sea View',
    E2: 'UALL',
    E3: 'BB',
    E4: 'ALL',
    F2: '300 EUR',
    G2: '500 EUR',
    K2: '1000000',
    N2: '10 EUR',
    ...changes,
  };
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!).replace(
    /<c r="([A-Z]+\d+)"([^>]*)><is><t><\/t><\/is><\/c>/g,
    (source, address: string, attrs: string) =>
      address in values
        ? `<c r="${address}"${attrs}><is><t>${values[address]}</t></is></c>`
        : source,
  );
  return zipSync({
    ...files,
    'xl/worksheets/sheet1.xml': strToU8(transform(sheet)),
  });
}
it('downloads a three-stay template and imports merged prices once for the whole itinerary', () => {
  const workbook = readFloatingWorkbook(mergedWorkbook());
  expect(workbook[3]?.[5]).toMatchObject({
    value: '300 EUR',
    mergedRows: { first: 2, last: 4 },
  });
  const rows = parseFloatingRows(
    workbook,
    { ...options, combined: true },
    threeStopTour,
    threeHotels,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    sourceRows: [2, 3, 4],
    nights: 7,
    startsOn: '2027-01-12',
    endsOn: '2027-01-19',
  });
  expect(rows[0]?.stays.map((stay) => [stay.hotelId, stay.nights])).toEqual([
    ['h1', 2],
    ['h2', 3],
    ['h3', 2],
  ]);
  expect(rows[0]?.prices.double).toEqual([
    { currency: 'EUR', amount: '300' },
    { currency: 'IRR', amount: '10000000' },
  ]);
  expect(rows[0]?.commission).toEqual([{ currency: 'EUR', amount: '10' }]);
});
it('uses separate merge ranges as separate packages even when their shared amounts match', () => {
  const bytes = mergedWorkbook({}, (sheet) => {
    const data = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(sheet)![1]!;
    const copy = data
      .replace(/<row r="1"[\s\S]*?<\/row>/, '')
      .replace(
        /r="([A-Z]*)([234])"/g,
        (_, col: string, row: string) => `r="${col}${Number(row) + 3}"`,
      )
      .replace('Sea View', 'Garden View');
    const merges = /<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/.exec(sheet)![1]!;
    return sheet
      .replace('</sheetData>', copy + '</sheetData>')
      .replace('count="10"', 'count="20"')
      .replace(
        '</mergeCells>',
        merges.replace(/([A-Z]+)[24]/g, (address) =>
          address.replace(/[24]$/, (n) => String(Number(n) + 3)),
        ) + '</mergeCells>',
      );
  });
  const rows = parseFloatingRows(
    readFloatingWorkbook(bytes),
    { ...options, combined: true },
    threeStopTour,
    threeHotels,
  );
  expect(rows.map((row) => row.sourceRows)).toEqual([
    [2, 3, 4],
    [5, 6, 7],
  ]);
  expect(rows.every((row) => row.prices.double?.[0]?.amount === '300')).toBe(
    true,
  );
});
it('rejects hidden non-anchor prices, overlapping ranges and inconsistent package boundaries', () => {
  expect(() =>
    readFloatingWorkbook(mergedWorkbook({ F3: '900 EUR' })),
  ).toThrow();
  expect(() =>
    readFloatingWorkbook(
      mergedWorkbook({}, (sheet) =>
        sheet.replace('</mergeCells>', '<mergeCell ref="F3:F4"/></mergeCells>'),
      ),
    ),
  ).toThrow();
  expect(() =>
    parseFloatingRows(
      readFloatingWorkbook(
        mergedWorkbook({}, (sheet) => sheet.replace('G2:G4', 'G2:G3')),
      ),
      { ...options, combined: true },
      threeStopTour,
      threeHotels,
    ),
  ).toThrow();
  expect(() =>
    parseFloatingRows(
      readFloatingWorkbook(
        mergedWorkbook({ B3: 'Hotel Three', B4: 'Hotel Two' }),
      ),
      { ...options, combined: true },
      threeStopTour,
      threeHotels,
    ),
  ).toThrow();
});
