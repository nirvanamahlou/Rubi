import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  HOTEL_IMPORT_HEADERS,
  HOTEL_IMPORT_MIME,
  parseHotelImportWorkbook,
} from './hotel-import.parser';

describe('downloadable hotel workbook', () => {
  it('reads the supplied 14-column workbook without shifting status or dropping profile fields', () => {
    const buffer = readFileSync(
      resolve(
        process.cwd(),
        'test/fixtures/hotel-master-template-14-columns.xlsx',
      ),
    );
    const parsed = parseHotelImportWorkbook({
      buffer,
      fileName: 'hotel-master-template.xlsx',
      mimeType: HOTEL_IMPORT_MIME,
      expectedCityName: 'کوش اداسی',
    });
    expect(parsed.issues).toEqual([]);
    expect(
      parsed.rows.map(({ rowNumber, englishName, isActive }) => ({
        rowNumber,
        englishName,
        isActive,
      })),
    ).toEqual([
      { rowNumber: 5, englishName: 'Charisma De Luxe Hotel', isActive: true },
      { rowNumber: 6, englishName: 'Ramada Resort Kusadasi', isActive: true },
      { rowNumber: 7, englishName: 'Signature Blue Resort', isActive: false },
    ]);
    expect(parsed.rows[0]).toMatchObject({
      address: 'Akyar Mevkii',
      starRating: 5,
      serviceLevel: 'لوکس',
      mealServiceCode: 'UALL',
      defaultRoomType: 'Double',
      facilities: ['استخر', 'وای‌فای', 'ساحل اختصاصی'],
      description: 'هتل ساحلی پنج ستاره',
      refundRules: 'تا ۷۲ ساعت طبق قرارداد',
      hotelRules: 'ورود ۱۴:۰۰ | خروج ۱۲:۰۰',
      mainImageSource: null,
      galleryImageSources: [],
      featuredSource: true,
      internalNote: null,
    });
    expect(
      parsed.rows.every((row) => /^HOTEL_[A-F0-9]{12}$/.test(row.code)),
    ).toBe(true);
    expect(new Set(parsed.rows.map((row) => row.code)).size).toBe(3);
    expect(parsed.mapping).toMatchObject({
      'شناسه هتل': '',
      'نام هتل': 'A',
      وضعیت: 'M',
      پرفروش: 'N',
      یادداشت: '',
    });
  });
  it('reads the three supplied hotel names and physical rows without importing formatted blanks', () => {
    const buffer = readFileSync(
      resolve(
        process.cwd(),
        'test/fixtures/hotel-master-template-18-columns.xlsx',
      ),
    );
    const parsed = parseHotelImportWorkbook({
      buffer,
      fileName: 'hotel-master-template.xlsx',
      mimeType: HOTEL_IMPORT_MIME,
      expectedCityName: 'کوش‌آداسی',
    });
    expect(parsed.issues).toEqual([]);
    expect(
      parsed.rows.map(({ rowNumber, code, englishName, isActive }) => ({
        rowNumber,
        code,
        englishName,
        isActive,
      })),
    ).toEqual([
      {
        rowNumber: 5,
        code: 'HTL-KUS-001',
        englishName: 'Charisma De Luxe Hotel',
        isActive: true,
      },
      {
        rowNumber: 6,
        code: 'HTL-KUS-002',
        englishName: 'Ramada Resort Kusadasi',
        isActive: true,
      },
      {
        rowNumber: 7,
        code: 'HTL-KUS-003',
        englishName: 'Signature Blue Resort',
        isActive: false,
      },
    ]);
  });
});

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
  nameOnly?: boolean;
  requiredOnly?: boolean;
  name?: string;
  formula?: boolean;
  macro?: boolean;
  badHeader?: boolean;
  code?: string;
  worksheetXml?: string;
  sharedStringsXml?: string;
  website?: string;
  freeSale?: string;
  persianName?: string;
}) {
  const headers = [...HOTEL_IMPORT_HEADERS];
  if (options?.badHeader) headers[0] = 'کد' as (typeof headers)[0];
  const values = [
    options?.code ?? 'HTL-BODRUM-001',
    options?.name ?? 'Test Hotel',
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
    options?.website ?? '',
    options?.freeSale ?? '',
    options?.persianName ?? '',
  ];
  const row = (number: number, source: readonly string[]) =>
    source
      .map((value, index) => {
        const reference = `${column(index)}${number}`;
        if (options?.nameOnly && number === 2 && index !== 1)
          return cell(reference, '');
        if (options?.requiredOnly && number === 2 && index !== 1 && index !== 3)
          return cell(reference, '');
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
  function withValues(values: Record<number, string>) {
    const files = unzipSync(fixture());
    let sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    for (const [index, value] of Object.entries(values)) {
      const ref = `${column(Number(index))}2`;
      sheet = sheet.replace(
        new RegExp(`<c r="${ref}"(?:[^>]*?\\/>|[^>]*>[\\s\\S]*?<\\/c>)`),
        cell(ref, value),
      );
    }
    files['xl/worksheets/sheet1.xml'] = strToU8(sheet);
    return zipSync(files);
  }
  it.each([160, 164, 500])(
    'retains a %i-character facility in full',
    (length) => {
      const facility = 'ر'.repeat(length);
      const parsed = parse(withValues({ 9: `استخر|${facility}` }));
      expect(parsed.issues).toEqual([]);
      expect(parsed.rows[0]?.facilities).toEqual(['استخر', facility]);
    },
  );
  it('reports the precise row/column for overlong facilities without changing text', () => {
    const facility = 'ر'.repeat(501);
    const parsed = parse(withValues({ 9: facility }));
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: 2,
        column: 'امکانات',
        code: 'VALUE_TOO_LONG',
      }),
    );
    expect(parsed.rows[0]?.facilities).toEqual([facility]);
  });
  it('counts Unicode characters consistently with PostgreSQL', () => {
    const facility = '🏊'.repeat(500);
    expect(parse(withValues({ 9: facility })).issues).toEqual([]);
    expect(parse(withValues({ 9: facility + '🏊' })).issues).toContainEqual(
      expect.objectContaining({ column: 'امکانات', code: 'VALUE_TOO_LONG' }),
    );
  });
  it.each([
    [7, 160],
    [8, 160],
    [10, 2000],
    [11, 2000],
    [12, 2000],
    [13, 2000],
    [14, 2000],
    [17, 2000],
  ])(
    'checks storage boundary for source column %i before commit',
    (index, limit) => {
      expect(parse(withValues({ [index]: 'x'.repeat(limit) })).issues).toEqual(
        [],
      );
      if (limit === 2000) {
        expect(() =>
          parse(withValues({ [index]: 'x'.repeat(limit + 1) })),
        ).toThrow(/Cell/);
      } else {
        const result = parse(withValues({ [index]: 'x'.repeat(limit + 1) }));
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            rowNumber: 2,
            column: HOTEL_IMPORT_HEADERS[index],
            code: 'VALUE_TOO_LONG',
          }),
        );
      }
    },
  );
  function websiteLink(target = 'https://hotel.example', ref = 'S2') {
    const files = unzipSync(fixture({ website: 'https://hotel.example' }));
    files['xl/worksheets/sheet1.xml'] = strToU8(
      strFromU8(files['xl/worksheets/sheet1.xml']!).replace(
        '</worksheet>',
        `<hyperlinks><hyperlink ref="${ref}" r:id="rId1"/></hyperlinks></worksheet>`,
      ),
    );
    files['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(
      relationship(
        target,
        'External',
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
      ),
    );
    return zipSync(files);
  }
  it('reads Excel auto-linked website cells as inert matching text', () => {
    const parsed = parse(websiteLink());
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]?.website).toBe('https://hotel.example');
    expect(parsed.security.ignoredWebsiteHyperlinkCount).toBe(1);
    expect(parsed.security.externalLinkCount).toBe(0);
  });
  it.each([
    'https://different.example',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:secret@hotel.example',
  ])('rejects unsafe or mismatched website hyperlink %s', (target) => {
    expect(() => parse(websiteLink(target))).toThrow(/Hyperlink/);
  });
  it('does not allow website hyperlink metadata on another column', () => {
    expect(() => parse(websiteLink('https://hotel.example', 'B2'))).toThrow(
      /Hyperlink/,
    );
  });
  it.each(['بله', 'TRUE', 'true', '1', '۱', '١'])(
    'reads free sale true %s with website and Persian name',
    (freeSale) => {
      const result = parse(
        fixture({
          website: 'https://hotel.example/path',
          freeSale,
          persianName: 'هتل آزمایشی',
        }),
      );
      expect(result.issues).toEqual([]);
      expect(result.rows[0]).toMatchObject({
        website: 'https://hotel.example/path',
        freeSale: true,
        persianName: 'هتل آزمایشی',
        englishName: 'Test Hotel',
      });
    },
  );
  it.each(['خیر', 'FALSE', 'false', '0', '۰', '٠'])(
    'reads explicit false without treating it as blank: %s',
    (freeSale) => {
      expect(parse(fixture({ freeSale })).rows[0]?.freeSale).toBe(false);
    },
  );
  it('validates extended optional fields and retains blank nulls', () => {
    expect(parse().rows[0]).toMatchObject({
      website: null,
      freeSale: null,
      persianName: null,
    });
    expect(
      parse(
        fixture({
          website: 'javascript:alert(1)',
          freeSale: 'maybe',
          persianName: 'x'.repeat(161),
        }),
      ).issues.map((i) => i.code),
    ).toEqual(
      expect.arrayContaining([
        'INVALID_WEBSITE',
        'INVALID_BOOLEAN',
        'VALUE_TOO_LONG',
      ]),
    );
  });
  it('reads the current downloadable extended template', () => {
    const parsed = parseHotelImportWorkbook({
      buffer: readFileSync(
        resolve(
          process.cwd(),
          '../web/public/templates/hotel-master-template.xlsx',
        ),
      ),
      fileName: 'hotels.xlsx',
      mimeType: HOTEL_IMPORT_MIME,
      expectedCityName: 'کوش اداسی',
    });
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.mapping).toMatchObject({
      وب‌سایت: 'O',
      'فروش آزاد': 'P',
      'نام فارسی': 'Q',
    });
  });
  function customColumns(headers: string[], values: string[]) {
    const files = unzipSync(fixture());
    const row = (number: number, data: string[]) =>
      `<row r="${number}">${data.map((value, index) => cell(`${column(index)}${number}`, value)).join('')}</row>`;
    files['xl/worksheets/sheet1.xml'] = strToU8(
      `<worksheet><sheetData>${row(1, headers)}${row(2, values)}</sheetData></worksheet>`,
    );
    return zipSync(files);
  }

  it('maps reordered optional columns and supports just name/city headers', () => {
    const parsed = parse(
      customColumns(
        ['شهر', 'وضعیت', 'نام هتل', 'آدرس'],
        ['بدروم', 'پیش‌نویس', 'Test Hotel', 'Test Address'],
      ),
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      englishName: 'Test Hotel',
      address: 'Test Address',
      isActive: false,
      starRating: null,
    });
    expect(parsed.mapping['نام هتل']).toBe('C');
    expect(
      parse(customColumns(['نام هتل', 'شهر'], ['Test Hotel', 'بدروم'])).issues,
    ).toEqual([]);
  });

  it('rejects duplicate, unknown or missing required headers and unlabelled data', () => {
    for (const [headers, values] of [
      [
        ['نام هتل', 'شهر', 'شهر'],
        ['Test', 'بدروم', 'بدروم'],
      ],
      [
        ['نام هتل', 'شهر', 'ناشناخته'],
        ['Test', 'بدروم', 'value'],
      ],
      [['نام هتل'], ['Test']],
      [
        ['نام هتل', 'شهر'],
        ['Test', 'بدروم', 'hidden'],
      ],
    ])
      expect(() => parse(customColumns(headers!, values!))).toThrow();
  });

  it('keeps rejecting formulas in the reduced template', () => {
    const files = unzipSync(
      customColumns(['نام هتل', 'شهر'], ['Test', 'بدروم']),
    );
    files['xl/worksheets/sheet1.xml'] = strToU8(
      strFromU8(files['xl/worksheets/sheet1.xml']!).replace(
        '</sheetData>',
        '<row r="3"><c r="A3"><f>1+1</f><v>2</v></c></row></sheetData>',
      ),
    );
    expect(() => parse(zipSync(files))).toThrow(/Formula/);
  });
  it('creates a stable identity with only hotel name and city supplied', () => {
    const parsed = parse(fixture({ requiredOnly: true }));
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      englishName: 'Test Hotel',
      city: 'بدروم',
      isActive: true,
      description: null,
      internalNote: null,
    });
    expect(parsed.rows[0]?.code).toMatch(/^HOTEL_[A-F0-9]{12}$/);
    expect(parse(fixture({ requiredOnly: true })).rows[0]?.code).toBe(
      parsed.rows[0]?.code,
    );
  });
  it.each([
    ['کوش اداسی', 'کوش‌آداسی'],
    ['  کوش\u00a0 اداسی  ', 'کوش‌آداسی'],
    ['كوش اداسي', 'کوش‌آداسی'],
    ['کوشاداسی', 'کوش آداسی'],
    [' kUs A dAsI ', 'KUSADASI'],
    ['Kuş adası', 'KUŞ ADASI'],
  ])(
    'matches city %s to %s without spacing or case sensitivity',
    (city, expectedCityName) => {
      expect(
        parseHotelImportWorkbook({
          buffer: fixture({ city, requiredOnly: true }),
          fileName: 'hotels.xlsx',
          mimeType: HOTEL_IMPORT_MIME,
          expectedCityName,
        }).issues,
      ).toEqual([]);
    },
  );

  it('requires both city and hotel name rather than silently filling city', () => {
    expect(parse(fixture({ nameOnly: true })).issues).toContainEqual(
      expect.objectContaining({ column: 'شهر', code: 'REQUIRED' }),
    );
    expect(
      parse(fixture({ requiredOnly: true, name: '' })).issues,
    ).toContainEqual(
      expect.objectContaining({ column: 'نام هتل', code: 'REQUIRED' }),
    );
  });
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
