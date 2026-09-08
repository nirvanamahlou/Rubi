import type {
  SalesContractListQuery,
  SalesContractSummary,
} from '@rubi/contracts';
import { strToU8, zipSync } from 'fflate';

export const SALES_EXPORT_LIMIT = 2000;
export const SALES_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const statusLabels = {
  DRAFT: 'پیش‌نویس',
  PENDING_CONFIRMATION: 'منتظر تأیید',
  CONFIRMED: 'تأییدشده',
  SENT_TO_RESERVATIONS: 'ارسال به رزرواسیون',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
};
const settlementLabels = {
  UNPAID: 'تسویه نشده',
  PARTIALLY_SETTLED: 'تسویه ناقص',
  SETTLED: 'تسویه شده',
  OVERPAID: 'بستانکار',
};
const services = {
  FLIGHT: 'پرواز',
  HOTEL: 'هتل',
  VISA: 'ویزا',
  TRANSFER: 'ترانسفر',
  INSURANCE: 'بیمه',
  TOUR: 'تور',
  BUS: 'اتوبوس',
  TRAIN: 'قطار',
  CIP: 'CIP',
  OTHER: 'سایر',
};

function xml(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        code >= 0x10000
      );
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function textCell(ref: string, value: string, style = 0) {
  // Always inline text: untrusted names/searches never become Excel formulas or links.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
function numericCell(ref: string, value: string, style: number) {
  if (style === 2 && /^-?\d+(\.0+)?$/.test(value)) style = 7;
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error('Invalid export amount');
  // Excel only preserves 15 significant digits. Keep exceptional large values exact.
  const significant = value
    .replace(/^-?0*/, '')
    .replace('.', '')
    .replace(/0+$/, '');
  return significant.length > 15
    ? textCell(ref, value, 0)
    : `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}
function dateCell(ref: string, value: string, dayOnly = false) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return textCell(ref, '');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: dayOnly ? 'UTC' : 'Asia/Tehran',
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)!.value);
  return numericCell(
    ref,
    String(
      Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000 + 25569,
    ),
    3,
  );
}

export function buildSalesXlsx(
  records: readonly SalesContractSummary[],
  query: SalesContractListQuery = {},
  now = new Date(),
): Uint8Array {
  const headers = [
    'شماره قرارداد',
    'مشتری',
    'تعداد مسافر',
    'خدمات',
    'وضعیت قرارداد',
    'وضعیت تسویه',
    'ارز',
    'مبلغ توافق‌شده',
    'پرداخت تأییدشده مالی',
    'مانده',
    'تاریخ سفر (میلادی)',
    'آخرین تغییر (میلادی)',
  ];
  const rows: string[] = [
    `<row r="1" ht="32" customHeight="1">${textCell('A1', 'گزارش قراردادهای فروش', 4)}</row>`,
    `<row r="2" ht="28" customHeight="1">${textCell('A2', `تعداد قرارداد: ${records.length} | زمان تهیه: ${now.toISOString()} | جست‌وجو: ${query.search || 'همه'} | تسویه: ${query.settlementStatus ? settlementLabels[query.settlementStatus] : 'همه'}`, 5)}</row>`,
    `<row r="3" ht="34" customHeight="1">${textCell('A3', 'هر ردیف یک قرارداد / ارز است؛ ارزها با هم جمع نمی‌شوند. مانده فقط با تأیید مالی کم می‌شود. مبالغ بیش از دقت 15 رقم Excel به‌صورت متن دقیق حفظ می‌شوند.', 5)}</row>`,
    `<row r="4" ht="32" customHeight="1">${headers.map((label, index) => textCell(`${String.fromCharCode(65 + index)}4`, label, 1)).join('')}</row>`,
  ];
  for (const record of records) {
    for (const balance of record.balances.length ? record.balances : [null]) {
      const row = rows.length + 1;
      const values = [
        record.contractNumber,
        record.customerNameSnapshot,
        '',
        record.services.map((kind) => services[kind]).join('، '),
        statusLabels[record.status],
        settlementLabels[record.settlementStatus],
        balance?.currencyCode ?? '',
      ];
      const cells = values.map((value, column) =>
        column === 2
          ? numericCell(`C${row}`, String(record.passengerNames.length), 6)
          : textCell(`${String.fromCharCode(65 + column)}${row}`, value),
      );
      for (const [column, amount] of [
        ['H', balance?.amount],
        ['I', balance?.confirmedPaid],
        ['J', balance?.outstanding],
      ] as const)
        cells.push(
          amount === undefined
            ? textCell(`${column}${row}`, '')
            : numericCell(`${column}${row}`, amount, 2),
        );
      cells.push(
        dateCell(`K${row}`, record.departureDate, true),
        dateCell(`L${row}`, record.updatedAt),
      );
      rows.push(
        `<row r="${row}" ht="44" customHeight="1">${cells.join('')}</row>`,
      );
    }
  }
  const end = rows.length;
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const pack = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const worksheet = `<worksheet xmlns="${main}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:L${end}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${[24, 30, 12, 30, 24, 19, 10, 24, 24, 24, 22, 22].map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A4:L${end}"/><mergeCells count="3"><mergeCell ref="A1:L1"/><mergeCell ref="A2:L2"/><mergeCell ref="A3:L3"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const xf = (font: number, fill: number, format: number, align = 'right') =>
    `<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${align}" vertical="center" wrapText="1"/></xf>`;
  const styles = `<styleSheet xmlns="${main}"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.########;[Red](#,##0.########);0"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts><fonts count="3"><font><sz val="11"/><color rgb="FF133969"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF133969"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF133969"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">${xf(0, 0, 0)}${xf(1, 2, 0, 'center')}${xf(0, 0, 164)}${xf(0, 0, 165, 'center')}${xf(2, 0, 0)}${xf(0, 0, 0)}${xf(0, 0, 1, 'center')}${xf(0, 0, 3)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${pack}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="قراردادها" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'قراردادها'!$4:$4</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${pack}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': worksheet,
    'xl/styles.xml': styles,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        strToU8(declaration + content),
      ]),
    ),
    { level: 6 },
  );
}
