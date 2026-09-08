'use client';

import { JAHAN_BASTAN_LOGO, NIYAYESH_SEIR_LOGO } from './contract-logos';
import type { HrPreviewCell } from './hr-preview-data';
import {
  buildSearchablePdf,
  type HrPdfPage,
  type PdfTextLine,
} from './hr-searchable-pdf';

export interface HrContractRecord {
  employee: string;
  number: string;
  company: string;
  type: string;
  startDate: string;
  endDate: string;
  position: string;
  amount: string;
  currency: string;
  obligations: string;
  confidentiality: string;
  disputeAuthority: string;
  status?: string;
  version?: string;
}

const cellText = (cell: HrPreviewCell | undefined) =>
  typeof cell === 'string' ? cell : (cell?.label ?? '');

export function contractRecordFromRow(
  columns: readonly string[],
  row: readonly HrPreviewCell[],
): HrContractRecord {
  const value = (label: string) => cellText(row[columns.indexOf(label)]);
  return {
    employee: value('کارمند'),
    number: value('شماره قرارداد') || value('شناسه'),
    company: value('شرکت'),
    type: value('نوع قرارداد'),
    startDate: value('تاریخ شروع'),
    endDate: value('تاریخ پایان'),
    position: value('سمت'),
    amount: value('مبلغ قرارداد'),
    currency: value('ارز'),
    obligations: value('موضوع و تعهدات'),
    confidentiality: value('مدت محرمانگی'),
    disputeAuthority: value('مرجع حل اختلاف'),
    status: value('وضعیت'),
    version: value('نسخه قرارداد') || '۱',
  };
}

const encoder = new TextEncoder();
const ascii = (value: string) => encoder.encode(value);

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function buildPdfFromJpeg(
  jpeg: Uint8Array,
  imageWidth: number,
  imageHeight: number,
): Uint8Array {
  const header = ascii('%PDF-1.4\n%RUBI\n');
  const pageContent = ascii('q 595 0 0 842 0 0 cm /Im0 Do Q\n');
  const objects = [
    ascii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    ascii('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
    ascii(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    ),
    concatBytes([
      ascii(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`,
      ),
      jpeg,
      ascii('\nendstream\nendobj\n'),
    ]),
    concatBytes([
      ascii(`5 0 obj\n<< /Length ${pageContent.byteLength} >>\nstream\n`),
      pageContent,
      ascii('endstream\nendobj\n'),
    ]),
  ];
  const offsets: number[] = [];
  let offset = header.byteLength;
  for (const object of objects) {
    offsets.push(offset);
    offset += object.byteLength;
  }
  const xrefOffset = offset;
  const xref = ascii(
    `xref\n0 6\n0000000000 65535 f \n${offsets
      .map((value) => `${String(value).padStart(10, '0')} 00000 n `)
      .join(
        '\n',
      )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );
  return concatBytes([header, ...objects, xref]);
}

const loadLogo = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('بارگذاری لوگوی شرکت انجام نشد.'));
    image.src = source;
  });

export async function createContractPdf(
  record: HrContractRecord,
): Promise<Uint8Array> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ساخت PDF در این مرورگر پشتیبانی نمی‌شود.');
  const logo = record.company.includes('جهان باستان')
    ? await loadLogo(JAHAN_BASTAN_LOGO)
    : record.company.includes('نیایش')
      ? await loadLogo(NIYAYESH_SEIR_LOGO)
      : null;
  const pages: HrPdfPage[] = [];
  let lines: PdfTextLine[] = [];
  let y = 0;
  const draw = (
    text: string,
    x: number,
    top: number,
    size: number,
    bold = false,
  ) => {
    context.font = `${bold ? '700' : '400'} ${size}px Vazirmatn, Tahoma, sans-serif`;
    context.fillText(text, x, top);
    lines.push({ text, x, y: top, size });
  };
  const start = () => {
    lines = [];
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1240, 1754);
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#103c78';
    if (logo) context.drawImage(logo, 70, 45, 145, 145);
    const title = record.type.includes('عدم افشا')
      ? 'توافق‌نامه عدم افشای اطلاعات'
      : `قرارداد ${record.type || 'همکاری'}`;
    draw(title, 1140, 105, 36, true);
    draw(record.company || 'شرکت ثبت نشده', 1140, 158, 25);
    context.fillStyle = '#687b93';
    draw(
      `${record.number} · نسخه ${record.version || '۱'} · ${record.status || 'پیش‌نویس'}`,
      1140,
      210,
      22,
    );
    context.strokeStyle = '#2178d3';
    context.beginPath();
    context.moveTo(70, 240);
    context.lineTo(1170, 240);
    context.stroke();
    y = 300;
  };
  const save = () => {
    context.fillStyle = '#71839a';
    draw(
      `منابع انسانی Rubi · صفحه ${(pages.length + 1).toLocaleString('fa-IR')}`,
      1140,
      1685,
      20,
    );
    const binary = atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]!);
    pages.push({
      image: Uint8Array.from(binary, (c) => c.charCodeAt(0)),
      width: 1240,
      height: 1754,
      lines: [...lines],
    });
  };
  const paragraph = (text: string, heading = false) => {
    context.font = `${heading ? '700' : '400'} ${heading ? 29 : 25}px Vazirmatn, Tahoma, sans-serif`;
    let line = '';
    const output: string[] = [];
    for (const character of text) {
      if (
        character === '\n' ||
        context.measureText(line + character).width > 1050
      ) {
        output.push(line);
        line = character === '\n' ? '' : character;
      } else line += character;
    }
    if (line) output.push(line);
    for (const part of output) {
      if (y > 1560) {
        save();
        start();
      }
      context.fillStyle = heading ? '#103c78' : '#26394d';
      draw(part, 1140, y, heading ? 29 : 25, heading);
      y += 43;
    }
    y += 15;
  };
  start();
  for (const [label, value] of [
    ['نام و نام خانوادگی', record.employee],
    ['شماره قرارداد', record.number],
    ['سمت', record.position],
    ['نوع قرارداد', record.type],
    ['تاریخ شروع', record.startDate],
    ['تاریخ پایان', record.endDate],
    ['مبلغ و ارز', [record.amount, record.currency].filter(Boolean).join(' ')],
  ])
    paragraph(`${label}: ${value || 'ثبت نشده'}`);
  for (const [label, value] of [
    ['موضوع و تعهدات', record.obligations],
    ['مدت محرمانگی', record.confidentiality],
    ['مرجع حل اختلاف', record.disputeAuthority],
  ]) {
    if (value) {
      paragraph(label!, true);
      paragraph(value);
    }
  }
  if (y > 1430) {
    save();
    start();
  }
  y += 70;
  paragraph('امضا و مهر شرکت                                      امضای همکار');
  save();
  return buildSearchablePdf(pages);
}

export async function downloadContractPdf(
  record: HrContractRecord,
): Promise<void> {
  const pdf = await createContractPdf(record);
  const blob = new Blob([new Uint8Array(pdf)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${record.number || 'hr-contract'}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
