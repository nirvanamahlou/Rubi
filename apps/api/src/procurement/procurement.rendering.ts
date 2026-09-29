import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { strToU8, zipSync } from 'fflate';
import { requireRule } from './domain/procurement.rules';

export const PROCUREMENT_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export type ProcurementExportTable = {
  title: string;
  headings: string[];
  rows: string[][];
  notes: string[];
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  );
function column(index: number): string {
  let value = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    value = String.fromCharCode(65 + ((n - 1) % 26)) + value;
  return value;
}

export function renderProcurementXlsx(table: ProcurementExportTable): Buffer {
  // Text cells preserve exact decimal strings and prevent formulas from source text.
  const values = [
    [table.title],
    ...table.notes.map((note) => [note]),
    table.headings,
    ...table.rows,
  ];
  const rows = values
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((value, cell) => `<c r="${column(cell)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`).join('')}</row>`,
    )
    .join('');
  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="خرید و تأمین" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><cols><col min="1" max="${table.headings.length}" width="24" customWidth="1"/></cols><sheetData>${rows}</sheetData></worksheet>`,
  };
  return Buffer.from(
    zipSync(
      Object.fromEntries(
        Object.entries(files).map(([name, value]) => [name, strToU8(value)]),
      ),
      { level: 6 },
    ),
  );
}

export function procurementPrintHtml(
  table: ProcurementExportTable,
  issuer: string,
): string {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(table.title)}</title><style>@page{size:A4 landscape;margin:16mm}body{font:12px Tahoma,Arial,sans-serif;color:#172a2b;line-height:1.7}header{border-bottom:3px solid #14766b;margin-bottom:18px}h1{font-size:22px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #bdcfcf;text-align:right;padding:7px;overflow-wrap:anywhere}th{background:#eaf4f2}thead{display:table-header-group}tr{break-inside:avoid}footer{font-size:10px;margin-top:12px}</style></head><body><header><strong>${escape(issuer)}</strong><h1>${escape(table.title)}</h1></header>${table.notes.map((note) => `<p>${escape(note)}</p>`).join('')}<table><thead><tr>${table.headings.map((heading) => `<th>${escape(heading)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table><footer>تولید و بایگانی سند به معنی ارسال خارجی یا تأیید پرداخت نیست.</footer></body></html>`;
}

/** Operator-configured Chromium binary; never accepts executable paths from a request. */
export async function renderProcurementPdf(
  table: ProcurementExportTable,
  issuer: string,
): Promise<Buffer> {
  const browser = process.env.PROCUREMENT_PDF_BROWSER_PATH;
  requireRule(
    browser && isAbsolute(browser),
    'PDF_RENDERER_UNAVAILABLE',
    'مسیر مرورگر تولید PDF در سرور پیکربندی نشده است.',
  );
  requireRule(
    (await stat(browser).catch(() => null))?.isFile(),
    'PDF_RENDERER_UNAVAILABLE',
    'مرورگر تولید PDF در دسترس نیست.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'rubi-procurement-pdf-'));
  try {
    const source = join(directory, 'source.html');
    const target = join(directory, 'output.pdf');
    await writeFile(source, procurementPrintHtml(table, issuer), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await promisify(execFile)(
      browser,
      [
        '--headless',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--no-first-run',
        '--no-pdf-header-footer',
        `--user-data-dir=${join(directory, 'profile')}`,
        `--print-to-pdf=${target}`,
        pathToFileURL(source).href,
      ],
      { timeout: 90000, windowsHide: true, maxBuffer: 1024 * 1024 },
    );
    const buffer = await readFile(target);
    requireRule(
      buffer.subarray(0, 5).toString() === '%PDF-',
      'PDF_RENDERER_UNAVAILABLE',
      'خروجی PDF معتبر تولید نشد.',
    );
    return buffer;
  } finally {
    // The sole deletion target is the absolute directory returned by mkdtemp above.
    await rm(directory, { recursive: true, force: true });
  }
}
