import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  HOTEL_IMPORT_HEADERS,
  HOTEL_IMPORT_MIME,
  parseHotelImportWorkbook,
} from './hotel-import.parser';

function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function column(index: number) {
  return String.fromCharCode(65 + index);
}

function cell(reference: string, value: string) {
  return value
    ? `<c r="${reference}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`
    : `<c r="${reference}"/>`;
}

function fixture(options?: {
  city?: string;
  formula?: boolean;
  macro?: boolean;
  badHeader?: boolean;
}) {
  const headers = [...HOTEL_IMPORT_HEADERS];
  if (options?.badHeader) headers[0] = 'کد' as (typeof headers)[0];
  const values = [
    'HTL-BODRUM-001',
    'Test Hotel',
    'بدروم',
    options?.city ?? 'بدروم',
    '',
    '5',
    '',
    'ALL',
    'DBL',
    'استخر|وای‌فای',
    'توضیح',
    'قانون استرداد',
    'قانون هتل',
    '/media/main.jpg',
    '',
    'منتشرشده',
    'TRUE',
    'یادداشت',
  ];
  const row = (number: number, source: readonly string[]) =>
    source
      .map((value, index) => {
        const reference = `${column(index)}${number}`;
        return options?.formula && number === 2 && index === 15
          ? `<c r="${reference}"><f>1+1</f><v>2</v></c>`
          : cell(reference, value);
      })
      .join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="Hotels"/><sheet name="راهنما"/></sheets></workbook>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<worksheet><sheetData><row>${row(1, headers)}</row><row>${row(2, values)}</row></sheetData></worksheet>`,
    ),
  };
  if (options?.macro) files['xl/vbaProject.bin'] = strToU8('macro');
  return zipSync(files);
}

function parse(buffer = fixture()) {
  return parseHotelImportWorkbook({
    buffer,
    fileName: 'HOTEL_IMPORT_V1.xlsx',
    mimeType: HOTEL_IMPORT_MIME,
    expectedCityName: 'بدروم',
  });
}

describe('parseHotelImportWorkbook', () => {
  it('reads status after self-closing empty cells in the exact v1 format', () => {
    const result = parse();
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      code: 'HTL-BODRUM-001',
      sourceStatus: 'منتشرشده',
      isActive: true,
      mealServiceCode: 'ALL',
    });
  });

  it('reports city scope mismatch', () => {
    expect(parse(fixture({ city: 'استانبول' })).issues).toContainEqual(
      expect.objectContaining({ code: 'CITY_SCOPE_MISMATCH' }),
    );
  });

  it('rejects changed headers, formulas and macro entries', () => {
    expect(() => parse(fixture({ badHeader: true }))).toThrow(
      /HOTEL_IMPORT_V1/,
    );
    expect(() => parse(fixture({ formula: true }))).toThrow(/Formula/);
    expect(() => parse(fixture({ macro: true }))).toThrow(/vbaProject/);
  });

  it('rejects spoofed MIME, extension and signature', () => {
    expect(() =>
      parseHotelImportWorkbook({
        buffer: fixture(),
        fileName: 'hotels.xlsm',
        mimeType: HOTEL_IMPORT_MIME,
        expectedCityName: 'بدروم',
      }),
    ).toThrow(/xlsx/);
    expect(() =>
      parseHotelImportWorkbook({
        buffer: fixture(),
        fileName: 'hotels.xlsx',
        mimeType: 'application/octet-stream',
        expectedCityName: 'بدروم',
      }),
    ).toThrow(/MIME/);
    expect(() =>
      parseHotelImportWorkbook({
        buffer: strToU8('fake'),
        fileName: 'hotels.xlsx',
        mimeType: HOTEL_IMPORT_MIME,
        expectedCityName: 'بدروم',
      }),
    ).toThrow(/Signature/);
  });
});
