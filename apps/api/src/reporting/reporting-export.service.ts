import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { strToU8, zipSync } from 'fflate';

import { LocalDocumentStorage } from '../documents/documents.storage';
import type { TravelReportResultV1 } from './reporting.contracts';

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function csv(result: TravelReportResultV1, reportName: string) {
  const metadata = [
    ['نام گزارش', reportName], ['کد گزارش', result.reportCode], ['نمای تأییدشده', result.sourceProjection],
    ['Grain', result.grain], ['زمان تولید UTC', result.generatedAtUtc], ['Filter Snapshot', JSON.stringify(result.filterSnapshot)],
  ];
  const lines = metadata.map((row) => row.map(csvCell).join(','));
  lines.push('', result.columns.map((column) => csvCell(column.label)).join(','));
  for (const row of result.rows) lines.push(result.columns.map((column) => csvCell(row[column.key])).join(','));
  return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
}

function xlsx(result: TravelReportResultV1, reportName: string) {
  const rows: string[][] = [
    ['نام گزارش', reportName], ['کد گزارش', result.reportCode], ['نمای تأییدشده', result.sourceProjection],
    ['زمان تولید UTC', result.generatedAtUtc], ['Filter Snapshot', JSON.stringify(result.filterSnapshot)], [],
    result.columns.map((column) => column.label),
    ...result.rows.map((row) => result.columns.map((column) => String(row[column.key] ?? ''))),
  ];
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    let n = columnIndex + 1; let col = ''; while (n) { const m = (n - 1) % 26; col = String.fromCharCode(65 + m) + col; n = Math.floor((n - 1) / 26); }
    return `<c r="${col}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="گزارش" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${sheetRows}</sheetData></worksheet>`),
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}

function pdf(result: TravelReportResultV1, reportName: string) {
  // Dependency-free, valid one-page PDF. Persian metadata remains embedded in UTF-8
  // comments; CSV/XLSX are the fidelity formats until a Unicode PDF renderer is wired.
  const text = `${reportName} | ${result.reportCode} | ${result.generatedAtUtc}`.replace(/[^\x20-\x7E]/g, '?');
  const stream = `BT /F1 12 Tf 50 780 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj 0 -24 Td (Approved projection: ${result.sourceProjection}) Tj 0 -24 Td (Rows: ${result.total}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body); body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'binary');
}

@Injectable()
export class ReportingExportService {
  constructor(@Inject(LocalDocumentStorage) private readonly storage: LocalDocumentStorage) {}

  build(format: 'CSV' | 'XLSX' | 'PDF', result: TravelReportResultV1, reportName: string) {
    const buffer = format === 'CSV' ? csv(result, reportName) : format === 'XLSX' ? xlsx(result, reportName) : pdf(result, reportName);
    const extension = format.toLowerCase();
    return {
      buffer,
      contentType: format === 'CSV' ? 'text/csv; charset=utf-8' : format === 'XLSX' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
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

  read(objectKey: string, expectedSizeBytes: number) { return this.storage.readQuarantined(objectKey, expectedSizeBytes); }
}
