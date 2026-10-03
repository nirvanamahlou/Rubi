import { BadRequestException } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';
import { createHash } from 'node:crypto';

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
const xmlPrefix = '(?:[A-Za-z_][\\w.-]*:)?';
const HOTEL_IMPORT_TITLE = 'قالب ورود اطلاعات پایه هتل‌ها — نیایش سیر';
const HOTEL_IMPORT_GUIDANCE =
  'هر هتل یک ردیف؛ شناسه هتل ثابت و یکتا باشد. ستون‌های چندمقداری را با | جدا کنید.';
const activeContentEntry =
  /(^|\/)(?:vbaProject|embeddings|activeX|ctrlProps|customUI|macrosheets?)(?:\/|\.|$)|oleObject/i;
const externalDataEntry =
  /(^|\/)(?:externalLinks|queryTables)(?:\/|\.|$)|(^|\/)connections\.xml$/i;

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
function generateHotelCode(englishName: string, city: string) {
  const token = createHash('sha256')
    .update(`${englishName}:${city}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  return `HOTEL_${token}`;
}

function failExternalRelationship(
  externalLinkCount: number,
  entries: readonly string[],
): never {
  throw new BadRequestException({
    code: 'HOTEL_IMPORT_EXTERNAL_RELATIONSHIP_FORBIDDEN',
    message: 'External Relationship یا External Data در فایل اکسل مجاز نیست.',
    details: { externalLinkCount, entries: entries.slice(0, 20) },
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

function xmlElement(name: string, flags = 'gi') {
  return new RegExp(
    `<${xmlPrefix}${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${xmlPrefix}${name}>`,
    flags,
  );
}

function xmlStart(name: string, flags = 'i') {
  return new RegExp(`<${xmlPrefix}${name}(?=\\s|/?>)`, flags);
}

function rejectXmlEntities(text: string) {
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(text))
    throw new BadRequestException({
      code: 'HOTEL_IMPORT_XML_ENTITY_FORBIDDEN',
      message: 'DTD و XML Entity در OOXML مجاز نیست.',
    });
}

function relationshipAttribute(source: string, name: string) {
  const expression = new RegExp(
    `\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    'i',
  );
  return decodeXml(source.match(expression)?.[2] ?? '').trim();
}

function inspectExternalRelationships(files: Record<string, Uint8Array>) {
  let externalLinkCount = 0;
  const entries: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    if (!/\.rels$/i.test(name)) continue;
    const xml = strFromU8(content);
    if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml))
      throw new BadRequestException({
        code: 'HOTEL_IMPORT_XML_ENTITY_FORBIDDEN',
        message: 'DTD و XML Entity در OOXML مجاز نیست.',
      });
    const relationshipExpression = new RegExp(
      `<${xmlPrefix}Relationship\\b([^>]*)\\/?\\s*>`,
      'gi',
    );
    for (const match of xml.matchAll(relationshipExpression)) {
      const attributes = match[1] ?? '';
      const targetMode = relationshipAttribute(
        attributes,
        'TargetMode',
      ).toLowerCase();
      const target = relationshipAttribute(attributes, 'Target');
      const externalScheme = /^(?:https?|ftp|file|smb|mailto|data):/i.test(
        target,
      );
      const uncPath = /^(?:\\\\|\/\/)[^/\\]/.test(target);
      const drivePath = /^[a-z]:[\\/]/i.test(target);
      const escapingPath = target
        .split(/[\\/]+/)
        .some((segment) => segment === '..');
      if (
        !target ||
        targetMode === 'external' ||
        externalScheme ||
        uncPath ||
        drivePath ||
        escapingPath
      ) {
        externalLinkCount += 1;
        entries.push(`${name}:${target || '[missing-target]'}`);
      }
    }
  }
  return { externalLinkCount, entries };
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
  const formula = xmlStart('f').test(cellXml);
  if (formula) fail('فایل دارای Formula است و قابل اعتماد نیست.');
  const inline = [...cellXml.matchAll(xmlElement('t'))]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('');
  if (cellType === 'inlineStr' || inline) return inline;
  const value = cellXml.match(xmlElement('v', 'i'))?.[1] ?? '';
  if (cellType === 's') return sharedStrings[Number(value)] ?? '';
  if (cellType === 'b') return value === '1' ? 'TRUE' : 'FALSE';
  return decodeXml(value);
}

function parseSharedStrings(xml?: Uint8Array) {
  if (!xml) return [];
  const text = strFromU8(xml);
  rejectXmlEntities(text);
  return [...text.matchAll(xmlElement('si'))].map((match) =>
    [...(match[1] ?? '').matchAll(xmlElement('t'))]
      .map((part) => decodeXml(part[1] ?? ''))
      .join(''),
  );
}

interface ParsedSheetRow {
  rowNumber: number;
  values: string[];
}

function parseSheet(xml: Uint8Array, sharedStrings: readonly string[]) {
  const text = strFromU8(xml);
  rejectXmlEntities(text);
  if (xmlStart('f').test(text)) fail('Formula در Sheet داده مجاز نیست.');
  if (xmlStart('hyperlink').test(text))
    fail('Hyperlink در Sheet داده مجاز نیست.');
  const parsedRows: ParsedSheetRow[] = [];
  const rowExpression = new RegExp(
    `<${xmlPrefix}row(?:\\s([^>]*))?>([\\s\\S]*?)<\\/${xmlPrefix}row>`,
    'gi',
  );
  const cellExpression = new RegExp(
    `<${xmlPrefix}c\\s+([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${xmlPrefix}c>)`,
    'gi',
  );
  let previousRowNumber = 0;
  for (const rowMatch of text.matchAll(rowExpression)) {
    if (parsedRows.length >= MAX_ROWS + 1)
      fail('تعداد ردیف‌ها از سقف ۱۰٬۰۰۰ بیشتر است.');
    const values: string[] = [];
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(cellExpression)) {
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
    const declaredRowNumber = Number(
      (rowMatch[1] ?? '').match(/\br="(\d+)"/i)?.[1],
    );
    const rowNumber =
      Number.isSafeInteger(declaredRowNumber) && declaredRowNumber > 0
        ? declaredRowNumber
        : previousRowNumber + 1;
    if (rowNumber <= previousRowNumber)
      fail('شماره ردیف‌های Sheet Hotels باید یکتا و صعودی باشد.');
    parsedRows.push({ rowNumber, values });
    previousRowNumber = rowNumber;
  }
  return parsedRows;
}

function isBlankRow(row: ParsedSheetRow) {
  return row.values.every((value) => !normalize(value ?? ''));
}

function isHeaderRow(row: ParsedSheetRow) {
  return (
    row.values.length === HOTEL_IMPORT_HEADERS.length &&
    HOTEL_IMPORT_HEADERS.every(
      (header, index) => normalize(row.values[index] ?? '') === header,
    )
  );
}

function dataRowsAfterCanonicalHeader(rows: readonly ParsedSheetRow[]) {
  const headerIndexes = rows.flatMap((row, index) =>
    isHeaderRow(row) ? [index] : [],
  );
  if (headerIndexes.length !== 1)
    fail('Headerهای Sheet Hotels با HOTEL_IMPORT_V1 مطابقت ندارند.');

  const headerIndex = headerIndexes[0] ?? -1;
  const preamble = rows.slice(0, headerIndex);
  const nonBlankPreamble = preamble.filter((row) => !isBlankRow(row));
  const directHeader = nonBlankPreamble.length === 0;
  const formattedTemplatePreamble =
    nonBlankPreamble.length === 2 &&
    nonBlankPreamble[0]?.rowNumber === 1 &&
    normalize(nonBlankPreamble[0]?.values[0] ?? '') === HOTEL_IMPORT_TITLE &&
    nonBlankPreamble[0]?.values
      .slice(1)
      .every((value) => !normalize(value ?? '')) &&
    nonBlankPreamble[1]?.rowNumber === 2 &&
    normalize(nonBlankPreamble[1]?.values[0] ?? '') === HOTEL_IMPORT_GUIDANCE &&
    nonBlankPreamble[1]?.values
      .slice(1)
      .every((value) => !normalize(value ?? '')) &&
    rows[headerIndex]?.rowNumber === 4;
  if (!directHeader && !formattedTemplatePreamble)
    fail('ساختار عنوان و راهنمای HOTEL_IMPORT_V1 معتبر نیست.');

  return rows.slice(headerIndex + 1).filter((row) => !isBlankRow(row));
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
  let externalDataPartCount = 0;
  const externalEntries: string[] = [];
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
        if (externalDataEntry.test(normalizedName)) {
          externalDataPartCount += 1;
          externalEntries.push(normalizedName);
          return false;
        }
        rejectedEntry = normalizedName;
        if (activeContentEntry.test(normalizedName)) {
          throw new Error('ZIP_SUSPICIOUS');
        }
        return (
          /\.rels$/i.test(normalizedName) ||
          /^(?:\[Content_Types\]\.xml|xl\/(?:workbook\.xml|sharedStrings\.xml|worksheets\/.+))$/i.test(
            normalizedName,
          )
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
  const relationshipInspection = inspectExternalRelationships(files);
  const externalLinkCount =
    externalDataPartCount + relationshipInspection.externalLinkCount;
  if (externalLinkCount > 0)
    failExternalRelationship(externalLinkCount, [
      ...externalEntries,
      ...relationshipInspection.entries,
    ]);
  const hotelSheet = files['xl/worksheets/sheet1.xml'];
  if (!workbookXml || !hotelSheet)
    fail('ساختار Workbook یا Sheet Hotels یافت نشد.');
  const workbookText = strFromU8(workbookXml);
  rejectXmlEntities(workbookText);
  if (
    !/name="Hotels"/i.test(workbookText) ||
    !/name="راهنما"/i.test(workbookText)
  )
    fail('نام Sheetها باید دقیقاً Hotels و راهنما باشد.');
  if (/\bDDE\b|WEBSERVICE\s*\(|HYPERLINK\s*\(/i.test(workbookText))
    fail('Remote Reference یا DDE در Workbook مجاز نیست.');

  const rows = dataRowsAfterCanonicalHeader(
    parseSheet(hotelSheet, parseSharedStrings(files['xl/sharedStrings.xml'])),
  );

  const issues: HotelImportValidationIssue[] = [];
  const warnings: HotelImportValidationIssue[] = [];
  const seenCodes = new Set<string>();
  const result: HotelImportSourceRow[] = [];
  const expectedCity = normalize(input.expectedCityName);

  rows.forEach(({ values: cells, rowNumber }) => {
    const englishName = normalize(cells[1] ?? '');
    const city = normalize(cells[3] ?? '');
    const suppliedCode = normalize(cells[0] ?? '').toUpperCase();
    const code = suppliedCode || generateHotelCode(englishName, city);
    const status = normalize(cells[15] ?? '');
    if (suppliedCode && !codePattern.test(suppliedCode))
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
