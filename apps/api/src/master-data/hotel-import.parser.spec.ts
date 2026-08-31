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
  entries?: Readonly<Record<string, string>>;
  city?: string;
  formula?: boolean;
  macro?: boolean;
  badHeader?: boolean;
  code?: string;
}) {
  const headers = [...HOTEL_IMPORT_HEADERS];
  if (options?.badHeader) headers[0] = 'کد' as (typeof headers)[0];
  const values = [
    options?.code ?? 'HTL-BODRUM-001',
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
  for (const [name, content] of Object.entries(options?.entries ?? {}))
    files[name] = strToU8(content);

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
function relationship(
  target: string,
  targetMode?: string,
  type = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
) {
  return `<Relationships><Relationship Id="rId1" Type="${type}" Target="${xml(target)}"${
    targetMode ? ` TargetMode="${targetMode}"` : ''
  }/></Relationships>`;
}

function externalRejection(buffer: ReturnType<typeof fixture>) {
  try {
    parse(buffer);
    throw new Error('Expected external relationship rejection.');
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('getResponse' in error) ||
      typeof error.getResponse !== 'function'
    )
      throw error;
    return error.getResponse() as {
      code: string;
      details: { externalLinkCount: number; entries: readonly string[] };
    };
  }
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

  it('generates a system code when the hotel identifier is empty', () => {
    const result = parse(fixture({ code: '' }));
    expect(result.issues).toEqual([]);
    expect(result.rows[0]?.code).toMatch(/^HOTEL_[A-F0-9]{12}$/);
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

  it.each([
    [
      'external workbook relationship',
      {
        'xl/_rels/workbook.xml.rels': relationship(
          'https://evil.invalid/data.xlsx',
          'External',
        ),
      },
    ],
    [
      'external worksheet relationship',
      {
        'xl/worksheets/_rels/sheet1.xml.rels': relationship(
          'https://evil.invalid/sheet',
          'External',
        ),
      },
    ],
    [
      'external hyperlink relationship',
      {
        'xl/worksheets/_rels/sheet1.xml.rels': relationship(
          'https://evil.invalid/link',
          'External',
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        ),
      },
    ],
    [
      'mixed-case TargetMode',
      {
        '_rels/.rels': relationship('https://evil.invalid/root', 'eXtErNaL'),
      },
    ],
    [
      'TargetMode with mixed attribute case and spacing',
      {
        '_rels/.rels':
          '<Relationships><Relationship Id="rId1" Type="x" Target="internal.xml" targetmode = " ExTeRnAl " /></Relationships>',
      },
    ],
    [
      'traversal target',
      {
        'xl/_rels/workbook.xml.rels': relationship(
          '../../outside/workbook.xml',
        ),
      },
    ],
    [
      'external target without TargetMode',
      {
        'xl/_rels/workbook.xml.rels': relationship(
          'https://evil.invalid/no-mode',
        ),
      },
    ],
    [
      'file scheme',
      {
        'xl/_rels/workbook.xml.rels': relationship('file:///etc/passwd'),
      },
    ],
    [
      'UNC path',
      {
        'xl/_rels/workbook.xml.rels': relationship(
          '\\\\server\\share\\data.xlsx',
        ),
      },
    ],
    [
      'externalLinks part',
      { 'xl/externalLinks/externalLink1.xml': '<externalLink/>' },
    ],
    ['connections part', { 'xl/connections.xml': '<connections/>' }],
    ['query table part', { 'xl/queryTables/queryTable1.xml': '<queryTable/>' }],
  ])('rejects %s with a stable error and real count', (_name, entries) => {
    const response = externalRejection(fixture({ entries }));
    expect(response.code).toBe('HOTEL_IMPORT_EXTERNAL_RELATIONSHIP_FORBIDDEN');
    expect(response.details.externalLinkCount).toBeGreaterThan(0);
    expect(response.details.entries.length).toBeGreaterThan(0);
  });

  it('accepts a healthy internal relationship with zero external links', () => {
    const result = parse(
      fixture({
        entries: {
          'xl/_rels/workbook.xml.rels': relationship('worksheets/sheet1.xml'),
        },
      }),
    );
    expect(result.security.externalLinkCount).toBe(0);
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
