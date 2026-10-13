import { neutralizeSpreadsheetFormula } from '../model/marketing';

interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
}

export function downloadRowsAsExcel({
  filename,
  sheetName,
  columns,
  rows,
}: ExcelExportOptions) {
  const header = columns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td>${escapeHtml(neutralizeSpreadsheetFormula(cell))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  const workbook = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(sheetName)}</title></head><body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob = new Blob([`\uFEFF${workbook}`], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(filename)}.xls`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
