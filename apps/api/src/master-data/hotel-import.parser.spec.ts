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
  worksheetXml?: string;
  sharedStringsXml?: string;
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
      options?.worksheetXml ??
        `<worksheet><sheetData><row>${row(1, headers)}</row><row>${row(2, values)}</row></sheetData></worksheet>`,
    ),
  };
  if (options?.sharedStringsXml)
    files['xl/sharedStrings.xml'] = strToU8(options.sharedStringsXml);
  for (const [name, content] of Object.entries(options?.entries ?? {}))
    files[name] = strToU8(content);

  if (options?.macro) files['xl/vbaProject.bin'] = strToU8('macro');
  return zipSync(files);
}

function formattedPrefixedFixture(options?: {
  formula?: boolean;
  hyperlink?: boolean;
  selfClosingFormula?: boolean;
  selfClosingHyperlink?: boolean;
  entityIn?: 'workbook' | 'sheet' | 'sharedStrings';
  duplicateHeader?: boolean;
  unexpectedPreamble?: boolean;
  explicitBlankPreambleRow?: boolean;
  duplicatePhysicalRow?: boolean;
}) {
  const title = 'قالب ورود اطلاعات پایه هتل‌ها — نیایش سیر';
  const guidance =
    'هر هتل یک ردیف؛ شناسه هتل ثابت و یکتا باشد. ستون‌های چندمقداری را با | جدا کنید.';
  const dataRows = [
    [
      'HTL-KUS-001',
      'Charisma De Luxe Hotel',
      'کوش‌آداسی',
      'کوش‌آداسی',
      'Akyar Mevkii',
      '5',
      'لوکس',
      'UALL',
      'Double',
      'استخر|وای‌فای|ساحل اختصاصی',
      'هتل ساحلی پنج ستاره',
      'تا ۷۲ ساعت طبق قرارداد',
      'ورود ۱۴:۰۰ | خروج ۱۲:۰۰',
      '',
      '',
      'منتشرشده',
      'TRUE',
      '',
    ],
    [
      'HTL-KUS-002',
      'Ramada Resort Kusadasi',
      'کوش‌آداسی',
      'کوش‌آداسی',
      '',
      '5',
      'لوکس',
      'UALL',
      'Double',
      'استخر|باشگاه|اسپا',
      '',
      '',
      '',
      '',
      '',
      'منتشرشده',
      'TRUE',
      '',
    ],
    [
      'HTL-KUS-003',
      'Signature Blue Resort',
      'کوش‌آداسی',
      'کوش‌آداسی',
      '',
      '4',
      'استاندارد',
      'ALL',
      'Double',
      'استخر|رستوران',
      '',
      '',
      '',
      '',
      '',
      'پیش‌نویس',
      'FALSE',
      '',
    ],
  ];
  const strings = [
    title,
    guidance,
    ...HOTEL_IMPORT_HEADERS,
    ...dataRows.flat(),
  ];
  const sharedIndex = (value: string) => strings.indexOf(value);
  const prefixedCell = (reference: string, value: string) => {
    if (!value) return `<x:c r="${reference}"/>`;
    if (value === 'TRUE' || value === 'FALSE')
      return `<x:c r="${reference}" t="b"><x:v>${value === 'TRUE' ? '1' : '0'}</x:v></x:c>`;
    if (/^\d+$/.test(value))
      return `<x:c r="${reference}"><x:v>${value}</x:v></x:c>`;
    return `<x:c r="${reference}" t="s"><x:v>${sharedIndex(value)}</x:v></x:c>`;
  };
  const prefixedRow = (number: number, source: readonly string[]) =>
    `<x:row r="${number}">${source
      .map((value, index) => prefixedCell(`${column(index)}${number}`, value))
      .join('')}</x:row>`;
  const emptyRow = (number: number) =>
    `<x:row r="${number}">${HOTEL_IMPORT_HEADERS.map((_, index) => `<x:c r="${column(index)}${number}"/>`).join('')}</x:row>`;
  const worksheetXml = `${options?.entityIn === 'sheet' ? '<!DOCTYPE x:worksheet [<!ENTITY unsafe "x">]>' : ''}<x:worksheet xmlns:x="urn:test">${options?.selfClosingFormula ? '<x:f/>' : ''}<x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c></x:row><x:row r="2"><x:c r="A2" t="s"><x:v>1</x:v></x:c></x:row>${options?.unexpectedPreamble ? '<x:row r="3"><x:c r="A3" t="inlineStr"><x:is><x:t>unexpected</x:t></x:is></x:c></x:row>' : options?.explicitBlankPreambleRow ? emptyRow(3) : ''}${prefixedRow(4, HOTEL_IMPORT_HEADERS)}${dataRows.map((values, index) => prefixedRow(options?.duplicatePhysicalRow && index === 1 ? 5 : index + 5, values)).join('')}${emptyRow(8)}${emptyRow(200)}${options?.duplicateHeader ? prefixedRow(201, HOTEL_IMPORT_HEADERS) : ''}${options?.formula ? '<x:row r="201"><x:c r="A201"><x:f>1+1</x:f><x:v>2</x:v></x:c></x:row>' : ''}</x:sheetData>${options?.hyperlink ? '<x:hyperlinks><x:hyperlink ref="A5"/></x:hyperlinks>' : ''}${options?.selfClosingHyperlink ? '<x:hyperlink/>' : ''}</x:worksheet>`;
  const sharedStringsXml = `${options?.entityIn === 'sharedStrings' ? '<!DOCTYPE x:sst [<!ENTITY unsafe "x">]>' : ''}<x:sst xmlns:x="urn:test">${strings
    .map((value) => `<x:si><x:t>${xml(value)}</x:t></x:si>`)
    .join('')}</x:sst>`;
  const buffer = fixture({ worksheetXml, sharedStringsXml });
  if (options?.entityIn !== 'workbook') return buffer;
  return fixture({
    worksheetXml,
    sharedStringsXml,
    entries: {
      'xl/workbook.xml':
        '<!DOCTYPE x:workbook [<!ENTITY unsafe "x">]><x:workbook xmlns:x="urn:test"><x:sheets><x:sheet name="Hotels"/><x:sheet name="راهنما"/></x:sheets></x:workbook>',
    },
  });
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

  it('accepts the canonical formatted prefixed template and preserves physical row numbers', () => {
    const result = parseHotelImportWorkbook({
      buffer: formattedPrefixedFixture(),
      fileName: 'hotel-master-template.xlsx',
      mimeType: HOTEL_IMPORT_MIME,
      expectedCityName: 'کوش‌آداسی',
    });

    expect(result.issues).toEqual([]);
    expect(
      result.rows.map(({ rowNumber, code }) => ({ rowNumber, code })),
    ).toEqual([
      { rowNumber: 5, code: 'HTL-KUS-001' },
      { rowNumber: 6, code: 'HTL-KUS-002' },
      { rowNumber: 7, code: 'HTL-KUS-003' },
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ rowNumber: 5, code: 'PROCUREMENT_OWNED' }),
      expect.objectContaining({ rowNumber: 5, code: 'SALES_OWNED' }),
      expect.objectContaining({ rowNumber: 6, code: 'SALES_OWNED' }),
    ]);
  });

  it('accepts an explicitly serialized blank third preamble row', () => {
    const result = parseHotelImportWorkbook({
      buffer: formattedPrefixedFixture({ explicitBlankPreambleRow: true }),
      fileName: 'hotel-master-template.xlsx',
      mimeType: HOTEL_IMPORT_MIME,
      expectedCityName: 'کوش‌آداسی',
    });
    expect(result.rows.map((row) => row.rowNumber)).toEqual([5, 6, 7]);
  });

  it.each([
    ['prefixed formula', { formula: true }, /Formula/],
    ['self-closing prefixed formula', { selfClosingFormula: true }, /Formula/],
    ['prefixed hyperlink', { hyperlink: true }, /Hyperlink/],
    [
      'self-closing prefixed hyperlink',
      { selfClosingHyperlink: true },
      /Hyperlink/,
    ],
    ['worksheet entity', { entityIn: 'sheet' as const }, /Entity/],
    ['shared-string entity', { entityIn: 'sharedStrings' as const }, /Entity/],
    ['workbook entity', { entityIn: 'workbook' as const }, /Entity/],
  ])('rejects %s without a namespace bypass', (_name, options, error) => {
    expect(() => parse(formattedPrefixedFixture(options))).toThrow(error);
  });

  it('rejects duplicate headers and non-approved preamble content', () => {
    expect(() =>
      parse(formattedPrefixedFixture({ duplicateHeader: true })),
    ).toThrow(/HOTEL_IMPORT_V1/);
    expect(() =>
      parse(formattedPrefixedFixture({ unexpectedPreamble: true })),
    ).toThrow(/عنوان و راهنما/);
  });

  it('rejects duplicate or non-monotonic physical row numbers', () => {
    expect(() =>
      parse(formattedPrefixedFixture({ duplicatePhysicalRow: true })),
    ).toThrow(/یکتا و صعودی/);
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
      'prefixed external relationship',
      {
        'xl/_rels/workbook.xml.rels':
          '<r:Relationships xmlns:r="urn:test"><r:Relationship Id="rId1" Type="x" Target="https://evil.invalid/prefixed" TargetMode="External"/></r:Relationships>',
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
