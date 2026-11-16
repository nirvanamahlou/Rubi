import { strToU8, zipSync } from 'fflate';
import type { TourPackageInputV1 } from '@nora/contracts';

const columns = [
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
  'commission',
];
const xml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const cell = (column: number, row: number, value: string, style: number) =>
  `<c r="${String.fromCharCode(65 + column)}${row}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;

/** Blank merged inputs match the selected itinerary; they contain no sale data. */
export function buildFloatingTourTemplate(
  tour: TourPackageInputV1,
): Uint8Array {
  const count = tour.details?.isCombined
    ? Math.max(2, tour.details.destinations?.length ?? 0)
    : 1;
  const header = `<row r="1" ht="32" customHeight="1">${columns.map((name, index) => cell(index, 1, name, 1)).join('')}</row>`;
  const rows = Array.from({ length: count }, (_, index) => {
    const row = index + 2;
    return `<row r="${row}" ht="28" customHeight="1">${columns.map((_, column) => cell(column, row, '', 2)).join('')}</row>`;
  }).join('');
  const ranges =
    count > 1
      ? [
          0,
          ...columns.map((_, index) => index).filter((index) => index >= 5),
        ].map(
          (column) =>
            `<mergeCell ref="${String.fromCharCode(65 + column)}2:${String.fromCharCode(65 + column)}${count + 1}"/>`,
        )
      : [];
  const guide = [
    'نام برگه قیمت تور و عنوان ستون‌ها را تغییر ندهید.',
    'نام هتل، نوع اتاق و خدمات هر اقامت را در یک ردیف، به ترتیب مقصدهای تور وارد کنید.',
    'در تور ترکیبی، قیمت کل ترکیب را فقط یک‌بار در سلول ادغام‌شده بنویسید؛ قیمت هر اقامت جدا نیست.',
    'برای ترکیب جدید، تمام ردیف‌های ترکیب و ادغام سلول‌های آن را کپی کنید.',
    'تاریخ حرکت مانند 2027-01-12 یا 1405/10/22 است؛ در حالت ویژه ماه خالی بماند.',
    'مبلغ بدون واحد، تومان است. برای ارز از EUR یا USD یا TRY و برای ریال از IRR استفاده کنید.',
    'نمونه مبلغ چندارزی: 300 EUR + 5000000 IRR. گروه بدون قیمت را خالی بگذارید.',
    'قیمت پرواز در ستون flight per person طبق قواعد واردکننده به قیمت اقامت اضافه می‌شود؛ قیمت نهاییِ شامل پرواز را با ستون پرواز خالی وارد کنید.',
    'کمیسیون در ستون commission جدا از قیمت فروش ثبت می‌شود.',
    'ثبت نهایی فقط پس از بررسی پیش‌نمایش انجام می‌شود.',
  ];
  const sheet = (data: string, extra = '') =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="14" width="23" customWidth="1"/></cols><sheetData>${data}</sheetData>${extra}</worksheet>`;
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="قیمت تور" sheetId="1" r:id="rId1"/><sheet name="راهنما" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163B70"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': sheet(
      header + rows,
      ranges.length
        ? `<mergeCells count="${ranges.length}">${ranges.join('')}</mergeCells>`
        : '',
    ),
    'xl/worksheets/sheet2.xml': sheet(
      guide
        .map(
          (text, index) =>
            `<row r="${index + 1}">${cell(0, index + 1, text, 0)}</row>`,
        )
        .join(''),
    ).replace('max="14" width="23"', 'max="1" width="140"'),
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, data]) => [name, strToU8(data)]),
    ),
  );
}
