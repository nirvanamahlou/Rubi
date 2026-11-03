import type { FlightLoadContractsV1 } from '@nora/contracts';
import { strToU8, zipSync } from 'fflate';
import { displayText, type DisplayLanguage } from '../common/i18n/language';

const xml = (value: string | number) =>
  Array.from(String(value))
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff)
      );
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value))
    : '';
/** Inline text protects leading zeros and formula-like customer/contract labels. Counts stay numeric. */
export function flightLoadWorkbook(
  report: FlightLoadContractsV1,
  language: DisplayLanguage = 'fa',
) {
  const headers = [
    'قرارداد',
    'مشتری',
    'وضعیت',
    'جهت',
    'مسیر',
    'تاریخ رفت',
    'تاریخ برگشت',
    'ایرلاین',
    'شماره پرواز',
    'کلاس',
    'بزرگسال',
    'کودک ۲ تا ۶',
    'کودک ۶ تا ۱۲',
    'کودک با سن نامشخص',
    'نوزاد',
    'تعداد مسافر',
    'تعداد صندلی',
  ].map((h) => displayText(h, language));
  const t = report.totals;
  const statuses: Record<string, string> = {
    CONFIRMED: 'تأییدشده',
    SENT_TO_RESERVATIONS: 'ارسال به رزرواسیون',
    IN_PROGRESS: 'در حال انجام',
    COMPLETED: 'تکمیل‌شده',
    CANCELLED: 'لغوشده',
  };
  const values: (string | number)[][] = [
    headers,
    ...report.data.map((r) => [
      r.contractNumber,
      r.customerName,
      displayText(statuses[r.status] ?? r.status, language),
      displayText(r.direction === 'OUTBOUND' ? 'رفت' : 'برگشت', language),
      `${r.originName} ← ${r.destinationName}`,
      date(r.outboundAt),
      date(r.returnAt),
      r.carrierName,
      r.serviceNumber,
      r.cabinClassCode,
      r.adults,
      r.children2To6,
      r.children6To12,
      r.childrenUnknownAge,
      r.infants,
      r.passengers,
      r.seats,
    ]),
    [
      language === 'en' ? 'Total' : 'جمع',
      t.contracts,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      t.adults,
      t.children2To6,
      t.children6To12,
      t.childrenUnknownAge,
      t.infants,
      t.passengers,
      t.seats,
    ],
  ];
  const rows = values
    .map(
      (row, i) =>
        `<row r="${i + 1}">${row.map((v, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}"${typeof v === 'number' ? ` t="n"><v>${v}</v>` : ` t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is>`}</c>`).join('')}</row>`,
    )
    .join('');
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    pack = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const files = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${pack}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="قراردادهای پرواز" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${pack}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${main}"><dimension ref="A1:Q${values.length}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="${language === 'fa' ? '1' : '0'}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="17" width="22" customWidth="1"/></cols><sheetData>${rows}</sheetData><autoFilter ref="A1:Q${report.data.length + 1}"/></worksheet>`,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [
        name,
        strToU8('<?xml version="1.0" encoding="UTF-8"?>' + content),
      ]),
    ),
    { level: 6 },
  );
}
