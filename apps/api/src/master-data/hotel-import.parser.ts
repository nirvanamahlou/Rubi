import { BadRequestException } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';

export const HOTEL_IMPORT_TEMPLATE_VERSION = 'HOTEL_IMPORT_V1' as const;
export const HOTEL_IMPORT_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const HOTEL_IMPORT_HEADERS = [
  'شناسه هتل',
  'نام هتل',
  'مقصد',
  'شهر',
  'آدرس',
  'تعداد ستاره',
  'درجه خدمات',
  'نوع خدمات',
  'نوع اتاق پیش‌فرض',
  'امکانات',
  'توضیحات',
  'قوانین استرداد',
  'قوانین هتل',
  'آدرس تصویر اصلی',
  'تصاویر گالری',
  'وضعیت',
  'پرفروش',
  'یادداشت',
] as const;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;
const MAX_ENTRIES = 200;
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 100;
const MAX_CELL_LENGTH = 2_000;
const codePattern = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const suspiciousEntry =
  /(^|\/)(?:vbaProject|externalLinks|embeddings|activeX|ctrlProps|connections|customUI|macrosheets?)(?:\/|\.|$)|oleObject/i;

export interface HotelImportSourceRow {
  rowNumber: number;
  code: string;
  englishName: string;
  destination: string;
  city: string;
  address: string | null;
  starRating: number | null;
  serviceLevel: string | null;
  mealServiceCode: string | null;
  defaultRoomType: string | null;
  facilities: readonly string[];
  description: string | null;
  refundRules: string | null;
  hotelRules: string | null;
  mainImageSource: string | null;
  galleryImageSources: readonly string[];
  sourceStatus: string;
  isActive: boolean;
  featuredSource: boolean;
  internalNote: string | null;
}

export interface HotelImportValidationIssue {
  rowNumber?: number;
  column?: string;
  code: string;
  message: string;
}

export interface ParsedHotelWorkbook {
  rows: readonly HotelImportSourceRow[];
  issues: readonly HotelImportValidationIssue[];
  warnings: readonly HotelImportValidationIssue[];
  mapping: Readonly<Record<(typeof HOTEL_IMPORT_HEADERS)[number], string>>;
  security: {
    entryCount: number;
    uncompressedBytes: number;
    formulaCount: 0;
    externalLinkCount: 0;
    macroCount: 0;
    malwareScanStatus: 'UNAVAILABLE';
  };
}

function fail(message: string): never {
  throw new BadRequestException({
    code: 'HOTEL_IMPORT_FILE_REJECTED',
    message,
  });
}

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&');
}

function cellColumn(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? '';
  let column = 0;
  for (const letter of letters)
    column = column * 26 + letter.charCodeAt(0) - 64;
  return column;
}

function cellText(
  cellXml: string,
  cellType: string | undefined,
  sharedStrings: readonly string[],
) {
  const formula = /<f(?:\s|>)/i.test(cellXml);
  if (formula) fail('فایل دارای Formula است و قابل اعتماد نیست.');
  const inline = [...cellXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('');
  if (cellType === 'inlineStr' || inline) return inline;
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? '';
  if (cellType === 's') return sharedStrings[Number(value)] ?? '';
  if (cellType === 'b') return value === '1' ? 'TRUE' : 'FALSE';
  return decodeXml(value);
}

function parseSharedStrings(xml?: Uint8Array) {
  if (!xml) return [];
  const text = strFromU8(xml);
  return [...text.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi)].map((match) =>
    [...(match[1] ?? '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)]
      .map((part) => decodeXml(part[1] ?? ''))
      .join(''),
  );
}

function parseSheet(xml: Uint8Array, sharedStrings: readonly string[]) {
  const text = strFromU8(xml);
  if (/<f(?:\s|>)/i.test(text)) fail('Formula در Sheet داده مجاز نیست.');
  if (/<hyperlink(?:\s|>)/i.test(text))
    fail('Hyperlink در Sheet داده مجاز نیست.');
  const parsedRows: string[][] = [];
  for (const rowMatch of text.matchAll(
    /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/gi,
  )) {
    if (parsedRows.length >= MAX_ROWS + 1)
      fail('تعداد ردیف‌ها از سقف ۱۰٬۰۰۰ بیشتر است.');
    const values: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(
      /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi,
    )) {
      const attributes = cellMatch[1] ?? '';
      const reference = attributes.match(/\br="([A-Z]+\d+)"/i)?.[1] ?? '';
      const column = cellColumn(reference);
      if (column < 1 || column > MAX_COLUMNS)
        fail('تعداد ستون‌ها از سقف ۱۰۰ بیشتر است.');
      const type = attributes.match(/\bt="([^"]+)"/i)?.[1];
      const value = normalize(
        cellText(cellMatch[2] ?? '', type, sharedStrings),
      );
      if (value.length > MAX_CELL_LENGTH)
        fail(`طول Cell ${reference} از سقف ۲٬۰۰۰ کاراکتر بیشتر است.`);
      values[column - 1] = value;
    }
    parsedRows.push(values);
  }
  return parsedRows;
}

function optional(value: string | undefined) {
  const normalized = normalize(value ?? '');
  return normalized || null;
}

function boolValue(value: string | undefined) {
  return ['TRUE', '1', 'بله'].includes(normalize(value ?? '').toUpperCase());
}

export function parseHotelImportWorkbook(input: {
  buffer: Uint8Array;
  fileName: string;
  mimeType: string;
  expectedCityName: string;
}): ParsedHotelWorkbook {
  if (input.buffer.byteLength < 4 || input.buffer.byteLength > MAX_FILE_BYTES)
    fail('حجم فایل باید بیشتر از صفر و حداکثر ۵ مگابایت باشد.');
  if (
    !/\.xlsx$/i.test(input.fileName) ||
    /\.(?:xls|xlsm|xlsb)$/i.test(input.fileName)
  )
    fail('فقط فایل با پسوند .xlsx پذیرفته می‌شود.');
  if (input.mimeType !== HOTEL_IMPORT_MIME)
    fail('MIME Type فایل .xlsx معتبر نیست.');
  if (
    input.buffer[0] !== 0x50 ||
    input.buffer[1] !== 0x4b ||
    input.buffer[2] !== 0x03 ||
    input.buffer[3] !== 0x04
  )
    fail('File Signature فایل .xlsx معتبر نیست.');

  let entryCount = 0;
  let uncompressedBytes = 0;
  let rejectedEntry: string | null = null;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(input.buffer, {
      filter(file) {
        entryCount += 1;
        uncompressedBytes += file.originalSize;
        if (
          entryCount > MAX_ENTRIES ||
          uncompressedBytes > MAX_UNCOMPRESSED_BYTES ||
          file.originalSize > MAX_UNCOMPRESSED_BYTES
        )
          throw new Error('ZIP_LIMIT');
        const normalizedName = file.name.replace(/\\/g, '/').replace(/^\//, '');
        if (normalizedName.includes('../') || normalizedName.startsWith('../'))
          throw new Error('ZIP_PATH');
        if (suspiciousEntry.test(normalizedName)) {
          rejectedEntry = normalizedName;
          throw new Error('ZIP_SUSPICIOUS');
        }
        return /^(?:\[Content_Types\]\.xml|_rels\/.+|xl\/(?:workbook\.xml|_rels\/.+|sharedStrings\.xml|worksheets\/.+))$/i.test(
          normalizedName,
        );
      },
    });
  } catch (error) {
    if (rejectedEntry) fail(`بخش ناامن در فایل شناسایی شد: ${rejectedEntry}`);
    fail(
      error instanceof Error && error.message === 'ZIP_PATH'
        ? 'Path Traversal در ZIP مجاز نیست.'
        : 'ساختار ZIP ناامن یا بیش از سقف مجاز است.',
    );
  }

  const workbookXml = files['xl/workbook.xml'];
  const hotelSheet = files['xl/worksheets/sheet1.xml'];
  if (!workbookXml || !hotelSheet)
    fail('ساختار Workbook یا Sheet Hotels یافت نشد.');
  const workbookText = strFromU8(workbookXml);
  if (
    !/name="Hotels"/i.test(workbookText) ||
    !/name="راهنما"/i.test(workbookText)
  )
    fail('نام Sheetها باید دقیقاً Hotels و راهنما باشد.');
  if (/\bDDE\b|WEBSERVICE\s*\(|HYPERLINK\s*\(/i.test(workbookText))
    fail('Remote Reference یا DDE در Workbook مجاز نیست.');

  const rows = parseSheet(
    hotelSheet,
    parseSharedStrings(files['xl/sharedStrings.xml']),
  );
  const headers = rows.shift()?.map(normalize) ?? [];
  if (
    headers.length !== HOTEL_IMPORT_HEADERS.length ||
    HOTEL_IMPORT_HEADERS.some((header, index) => headers[index] !== header)
  )
    fail('Headerهای Sheet Hotels با HOTEL_IMPORT_V1 مطابقت ندارند.');

  const issues: HotelImportValidationIssue[] = [];
  const warnings: HotelImportValidationIssue[] = [];
  const seenCodes = new Set<string>();
  const result: HotelImportSourceRow[] = [];
  const expectedCity = normalize(input.expectedCityName);

  rows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const code = normalize(cells[0] ?? '').toUpperCase();
    const englishName = normalize(cells[1] ?? '');
    const city = normalize(cells[3] ?? '');
    const status = normalize(cells[15] ?? '');
    if (!codePattern.test(code))
      issues.push({
        rowNumber,
        column: 'شناسه هتل',
        code: 'INVALID_CODE',
        message: 'شناسه هتل معتبر نیست.',
      });
    if (!englishName)
      issues.push({
        rowNumber,
        column: 'نام هتل',
        code: 'REQUIRED',
        message: 'نام هتل الزامی است.',
      });
    if (!city || city !== expectedCity)
      issues.push({
        rowNumber,
        column: 'شهر',
        code: 'CITY_SCOPE_MISMATCH',
        message: 'شهر ردیف با شهر انتخاب‌شده یکسان نیست.',
      });
    if (!['پیش‌نویس', 'منتشرشده'].includes(status))
      issues.push({
        rowNumber,
        column: 'وضعیت',
        code: 'INVALID_STATUS',
        message: 'وضعیت باید پیش‌نویس یا منتشرشده باشد.',
      });
    if (seenCodes.has(code))
      issues.push({
        rowNumber,
        column: 'شناسه هتل',
        code: 'DUPLICATE_IN_FILE',
        message: 'شناسه در همین فایل تکراری است.',
      });
    seenCodes.add(code);
    const starText = normalize(cells[5] ?? '');
    const starRating = starText ? Number(starText) : null;
    if (
      starRating !== null &&
      (!Number.isInteger(starRating) || starRating < 1 || starRating > 5)
    )
      issues.push({
        rowNumber,
        column: 'تعداد ستاره',
        code: 'INVALID_STAR',
        message: 'تعداد ستاره باید عدد صحیح ۱ تا ۵ باشد.',
      });
    if (optional(cells[11]))
      warnings.push({
        rowNumber,
        column: 'قوانین استرداد',
        code: 'PROCUREMENT_OWNED',
        message: 'قوانین استرداد وارد Master Data نمی‌شود.',
      });
    if (optional(cells[13]) || optional(cells[14]))
      warnings.push({
        rowNumber,
        column: 'تصاویر',
        code: 'AWAITING_DOCUMENTS',
        message: 'تصاویر تا اتصال Documents وارد نمی‌شوند.',
      });
    if (boolValue(cells[16]))
      warnings.push({
        rowNumber,
        column: 'پرفروش',
        code: 'SALES_OWNED',
        message:
          'پرفروش متعلق به Marketing/Sales است و وارد Master Data نمی‌شود.',
      });
    result.push({
      rowNumber,
      code,
      englishName,
      destination: normalize(cells[2] ?? ''),
      city,
      address: optional(cells[4]),
      starRating,
      serviceLevel: optional(cells[6]),
      mealServiceCode: optional(cells[7])?.toUpperCase() ?? null,
      defaultRoomType: optional(cells[8]),
      facilities: (cells[9] ?? '').split('|').map(normalize).filter(Boolean),
      description: optional(cells[10]),
      refundRules: optional(cells[11]),
      hotelRules: optional(cells[12]),
      mainImageSource: optional(cells[13]),
      galleryImageSources: (cells[14] ?? '')
        .split('|')
        .map(normalize)
        .filter(Boolean),
      sourceStatus: status,
      isActive: status === 'منتشرشده',
      featuredSource: boolValue(cells[16]),
      internalNote: optional(cells[17]),
    });
  });

  return {
    rows: result,
    issues,
    warnings,
    mapping: Object.fromEntries(
      HOTEL_IMPORT_HEADERS.map((header, index) => [
        header,
        String.fromCharCode(65 + index),
      ]),
    ) as ParsedHotelWorkbook['mapping'],
    security: {
      entryCount,
      uncompressedBytes,
      formulaCount: 0,
      externalLinkCount: 0,
      macroCount: 0,
      malwareScanStatus: 'UNAVAILABLE',
    },
  };
}
