import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { strToU8, zipSync } from 'fflate';

import { LocalDocumentStorage } from '../documents/documents.storage';
import type { TravelReportResultV1 } from './reporting.contracts';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function csv(result: TravelReportResultV1, reportName: string) {
  const metadata = [
    ['نام گزارش', reportName],
    ['کد گزارش', result.reportCode],
    ['نمای تأییدشده', result.sourceProjection],
    ['Grain', result.grain],
    ['زمان تولید UTC', result.generatedAtUtc],
    ['Filter Snapshot', JSON.stringify(result.filterSnapshot)],
  ];
  const lines = metadata.map((row) => row.map(csvCell).join(','));
  lines.push(
    '',
    result.columns.map((column) => csvCell(column.label)).join(','),
  );
  for (const row of result.rows)
    lines.push(
      result.columns.map((column) => csvCell(row[column.key])).join(','),
    );
  return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
}

const exportFilterLabels: Readonly<Record<string, string>> = {
  fromUtc: 'از تاریخ (UTC)',
  toUtc: 'تا تاریخ (UTC)',
  currencyCode: 'ارز',
  branch: 'شعبه',
  expert: 'کارشناس',
  status: 'وضعیت',
  site: 'سایت',
  salesChannel: 'کانال فروش',
  serviceType: 'نوع خدمت',
  origin: 'مبدأ',
  destination: 'مقصد',
  route: 'مسیر',
  airline: 'ایرلاین',
  provider: 'تأمین‌کننده',
  agency: 'آژانس',
  customerType: 'نوع مشتری',
  issueStatus: 'وضعیت صدور',
  reservationStatus: 'وضعیت رزرو',
  leadSource: 'منبع لید',
};

function excelColumn(index: number) {
  let value = index + 1;
  let column = '';
  while (value) {
    column = String.fromCharCode(65 + ((value - 1) % 26)) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function groupedDecimal(value: string) {
  const sign = value.startsWith('-') ? '-' : '';
  const [integer, fraction] = value.replace(/^-/, '').split('.');
  const grouped = (integer ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}

function exportFilterEntries(result: TravelReportResultV1): [string, string][] {
  const snapshot = result.filterSnapshot;
  const entries: [string, string][] = [];
  if (snapshot.legalEntityId) entries.push(['شرکت', snapshot.legalEntityId]);
  if (snapshot.branchIds.length)
    entries.push(['محدوده شعب', snapshot.branchIds.join('، ')]);
  for (const [key, value] of Object.entries(snapshot.filters)) {
    const text = Array.isArray(value) ? value.join('، ') : String(value);
    if (text) entries.push([exportFilterLabels[key] ?? key, text]);
  }
  return entries.length ? entries : [['فیلترها', 'بدون فیلتر انتخابی']];
}

type ExcelCell = { value: string; style?: number; numeric?: boolean };

function datasetCell(
  column: TravelReportResultV1['columns'][number],
  value: unknown,
): ExcelCell {
  const text = String(value ?? '');
  if (column.kind === 'TEXT' || /(?:id|code)$/i.test(column.key))
    return { value: text };
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return { value: text };
  const significantDigits = text
    .replace(/[^\d]/g, '')
    .replace(/^0+/, '').length;
  // Excel retains at most 15 significant digits. Preserve longer amounts as
  // grouped text instead of silently changing their financial value.
  if (significantDigits > 15) return { value: groupedDecimal(text) };
  return { value: text, style: 4, numeric: true };
}

function xlsx(result: TravelReportResultV1, reportName: string) {
  const filters = exportFilterEntries(result);
  const rows: ExcelCell[][] = [
    ['نام گزارش', reportName, 'زمان تولید UTC', result.generatedAtUtc].map(
      (value) => ({ value, style: 1 }),
    ),
    [],
    filters.map(([label]) => ({ value: label, style: 2 })),
    filters.map(([, value]) => ({ value, style: 3 })),
    [],
    result.columns.map((column) => ({ value: column.label, style: 2 })),
    ...result.rows.map((row) =>
      result.columns.map((column) => datasetCell(column, row[column.key])),
    ),
  ];
  const columnCount = Math.max(4, filters.length, result.columns.length);
  const columnWidths = Array.from({ length: columnCount }, (_, index) => {
    const longest = Math.max(
      ...rows.slice(0, 6).map((row) => row[index]?.value.length ?? 0),
    );
    const width = Math.min(42, Math.max(18, Math.ceil(longest * 0.9) + 3));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join('');
  const filterRowHeight = Math.min(
    120,
    Math.max(
      22,
      Math.ceil(Math.max(...filters.map(([, value]) => value.length)) / 42) *
        17,
    ),
  );
  const sheetRows = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}"${rowIndex === 3 ? ` ht="${filterRowHeight}" customHeight="1"` : ''}>${row
          .map((cell, columnIndex) => {
            const address = `${excelColumn(columnIndex)}${rowIndex + 1}`;
            const style = cell.style === undefined ? '' : ` s="${cell.style}"`;
            return cell.numeric
              ? `<c r="${address}"${style}><v>${cell.value}</v></c>`
              : `<c r="${address}"${style} t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
          })
          .join('')}</row>`,
    )
    .join('');
  const files = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="گزارش" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##########"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FF17396D"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17396D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2FB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columnWidths}</cols><sheetData>${sheetRows}</sheetData><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`,
    ),
    'xl/worksheets/_rels/sheet1.xml.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>',
    ),
    'xl/tables/table1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="ReportData" displayName="ReportData" ref="A6:${excelColumn(result.columns.length - 1)}${rows.length}" totalsRowShown="0"><autoFilter ref="A6:${excelColumn(result.columns.length - 1)}${rows.length}"/><tableColumns count="${result.columns.length}">${result.columns.map((column, index) => `<tableColumn id="${index + 1}" name="${escapeXml(column.label)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`,
    ),
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}

function pdf(result: TravelReportResultV1, reportName: string) {
  // Dependency-free, valid one-page PDF. Persian metadata remains embedded in UTF-8
  // comments; CSV/XLSX are the fidelity formats until a Unicode PDF renderer is wired.
  const text =
    `${reportName} | ${result.reportCode} | ${result.generatedAtUtc}`.replace(
      /[^\x20-\x7E]/g,
      '?',
    );
  const stream = `BT /F1 12 Tf 50 780 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj 0 -24 Td (Approved projection: ${result.sourceProjection}) Tj 0 -24 Td (Rows: ${result.total}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
    .join(
      '\n',
    )}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'binary');
}

@Injectable()
export class ReportingExportService {
  constructor(
    @Inject(LocalDocumentStorage)
    private readonly storage: LocalDocumentStorage,
  ) {}

  build(
    format: 'CSV' | 'XLSX' | 'PDF',
    result: TravelReportResultV1,
    reportName: string,
  ) {
    const buffer =
      format === 'CSV'
        ? csv(result, reportName)
        : format === 'XLSX'
          ? xlsx(result, reportName)
          : pdf(result, reportName);
    const extension = format.toLowerCase();
    return {
      buffer,
      contentType:
        format === 'CSV'
          ? 'text/csv; charset=utf-8'
          : format === 'XLSX'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
      extension,
      checksum: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  async store(exportId: string, _extension: string, buffer: Buffer) {
    // Reporting artifacts share the encrypted Documents quarantine. Keep the
    // object key on the single versioned contract accepted by that boundary;
    // the user-facing extension remains in export metadata, not the blob key.
    const objectKey = `documents/${exportId}/v1/${randomUUID()}.bin`;
    await this.storage.putQuarantined(objectKey, buffer);
    return objectKey;
  }

  read(objectKey: string, expectedSizeBytes: number) {
    return this.storage.readQuarantined(objectKey, expectedSizeBytes);
  }
}
