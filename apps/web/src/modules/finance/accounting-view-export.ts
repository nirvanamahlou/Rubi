import {
  buildSearchablePdf,
  type PdfPage,
} from '@/lib/customer-affairs-pdf-core';
import { createAccountingXlsx } from './accounting-view-xlsx';

export function accountingViewRows(root: HTMLElement): string[][] {
  const rows: string[][] = [];
  for (const heading of root.querySelectorAll('h2'))
    rows.push([heading.textContent?.trim() ?? '']);
  for (const field of root.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('input,textarea,select')) {
    if (
      field.closest('[hidden], [role="toolbar"]') ||
      ['hidden', 'password', 'button', 'submit', 'search'].includes(field.type)
    )
      continue;
    const label =
      field.getAttribute('aria-label') ||
      (field.id
        ? Array.from(root.querySelectorAll('label')).find(
            (item) => item.htmlFor === field.id,
          )?.textContent
        : '') ||
      '';
    if (!label.trim()) continue;
    const value =
      field instanceof HTMLSelectElement
        ? (field.selectedOptions[0]?.textContent ?? '')
        : field instanceof HTMLInputElement &&
            ['checkbox', 'radio'].includes(field.type)
          ? field.checked
            ? 'بله'
            : 'خیر'
          : field.value;
    rows.push([label.trim(), value]);
  }
  for (const table of root.querySelectorAll('table')) {
    if (table.closest('[hidden]')) continue;
    const headings = Array.from(table.tHead?.rows[0]?.cells ?? []);
    const excluded = new Set(
      headings.flatMap((cell, index) => {
        const label = cell.textContent?.trim() ?? '';
        return ['عملیات', 'انتخاب'].includes(label) ||
          (!label && cell.querySelector('input[type="checkbox"]'))
          ? [index]
          : [];
      }),
    );
    for (const row of table.rows) {
      const values = Array.from(row.cells)
        .filter((_, index) => !excluded.has(index))
        .map((cell) => {
          const field = cell.querySelector<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >(
            'input:not([type="checkbox"]):not([type="hidden"]), textarea, select',
          );
          return field instanceof HTMLSelectElement
            ? (field.selectedOptions[0]?.textContent ?? '')
            : field
              ? field.value
              : (cell.textContent?.trim() ?? '');
        });
      if (values.length) rows.push(values);
    }
    rows.push([]);
  }
  return rows;
}

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return { url, name };
}

export async function exportAccountingView(
  root: HTMLElement,
  format: 'xlsx' | 'pdf',
) {
  const rows = accountingViewRows(root);
  if (!rows.length)
    throw new Error('اطلاعاتی برای خروجی در این صفحه نمایش داده نشده است.');
  const title = rows[0]?.[0] || 'حسابداری';
  if (format === 'xlsx') {
    return download(
      createAccountingXlsx(rows),
      'accounting-view.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }
  await document.fonts.ready;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('امکان ساخت PDF در این مرورگر موجود نیست.');
  measure.font = '24px Vazirmatn, sans-serif';
  const lines = rows.flatMap((row) => {
    const wrapped: string[] = [];
    let line = '';
    for (const character of row.join(' | ')) {
      if (
        character === '\n' ||
        (line && measure.measureText(line + character).width > 1050)
      ) {
        wrapped.push(line);
        line = '';
      }
      if (character !== '\n') line += character;
    }
    wrapped.push(line);
    return wrapped;
  });
  const pages: PdfPage[] = [];
  for (let offset = 0; offset < lines.length; offset += 34) {
    const canvas = document.createElement('canvas');
    canvas.width = 1190;
    canvas.height = 1684;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('امکان ساخت PDF در این مرورگر موجود نیست.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#172554';
    context.font = '24px Vazirmatn, sans-serif';
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillText(`${title} — اطلاعات نمایش‌داده‌شده`, 1120, 65);
    const pageLines = lines
      .slice(offset, offset + 34)
      .map((text, index) => ({ text, x: 35, y: 770 - index * 21, size: 11 }));
    lines
      .slice(offset, offset + 34)
      .forEach((text, index) => context.fillText(text, 1120, 125 + index * 42));
    context.fillText(`صفحه ${pages.length + 1}`, 1120, 1620);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('ساخت PDF ناموفق بود.')),
        'image/jpeg',
        0.94,
      ),
    );
    pages.push({
      image: new Uint8Array(await blob.arrayBuffer()),
      width: 595,
      height: 842,
      lines: pageLines,
    });
  }
  return download(
    buildSearchablePdf(pages),
    'accounting-view.pdf',
    'application/pdf',
  );
}
