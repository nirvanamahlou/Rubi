'use client';

import { JAHAN_BASTAN_LOGO, NIYAYESH_SEIR_LOGO } from './contract-logos';
import type { HrPreviewCell } from './hr-preview-data';

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
    number: value('شماره قرارداد'),
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
      .join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
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

function wrapRtlText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  for (const item of lines) {
    context.fillText(item, x, y);
    y += lineHeight;
  }
  return y;
}

const contractTitle = (type: string) => {
  if (type.includes('عدم افشا')) return 'توافق‌نامه عدم افشای اطلاعات';
  if (type.includes('عدم رقابت')) return 'توافق‌نامه عدم رقابت';
  if (type.includes('مالکیت فکری')) return 'توافق‌نامه محرمانگی و مالکیت فکری';
  return `قرارداد همکاری ${type}`;
};

async function renderContract(record: HrContractRecord): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ساخت خروجی PDF در این مرورگر پشتیبانی نمی‌شود.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#0b2f67';
  context.font = '700 44px Vazirmatn, Tahoma, sans-serif';
  context.fillText(contractTitle(record.type), 1120, 130);

  const logo = await loadLogo(
    record.company.includes('جهان باستان') ? JAHAN_BASTAN_LOGO : NIYAYESH_SEIR_LOGO,
  );
  context.drawImage(logo, 70, 55, 150, 150);
  context.font = '500 25px Vazirmatn, Tahoma, sans-serif';
  context.fillStyle = '#475569';
  context.fillText(record.company || 'نیایش سیر', 1120, 180);
  context.strokeStyle = '#1d73d5';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(70, 235);
  context.lineTo(1170, 235);
  context.stroke();

  const items = [
    ['شماره قرارداد', record.number],
    ['نام و نام خانوادگی', record.employee],
    ['سمت', record.position],
    ['نوع قرارداد', record.type],
    ['تاریخ شروع', record.startDate],
    ['تاریخ پایان', record.endDate || 'نامحدود'],
    ['مبلغ قرارداد', `${record.amount || 'طبق پیوست مالی'} ${record.currency}`.trim()],
  ] as const;
  let y = 315;
  context.font = '600 26px Vazirmatn, Tahoma, sans-serif';
  for (const [label, value] of items) {
    context.fillStyle = '#64748b';
    context.fillText(`${label}:`, 1120, y);
    context.fillStyle = '#111827';
    context.fillText(value || '—', 800, y);
    y += 55;
  }

  const clauses = [
    ['موضوع و تعهدات', record.obligations || 'انجام وظایف شغلی و رعایت مقررات و رویه‌های مصوب شرکت.'],
    ['محرمانگی', record.confidentiality || 'اطلاعات محرمانه در طول همکاری و پس از پایان آن باید حفاظت شود.'],
    ['حل اختلاف', record.disputeAuthority || 'اختلاف ابتدا از طریق مذاکره و سپس در مراجع صالح رسیدگی می‌شود.'],
  ] as const;
  y += 25;
  for (const [title, body] of clauses) {
    context.fillStyle = '#0b2f67';
    context.font = '700 29px Vazirmatn, Tahoma, sans-serif';
    context.fillText(title, 1120, y);
    y += 48;
    context.fillStyle = '#243244';
    context.font = '400 25px Vazirmatn, Tahoma, sans-serif';
    y = wrapRtlText(context, body, 1120, y, 1030, 42) + 35;
  }

  context.strokeStyle = '#cbd5e1';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(110, 1510);
  context.lineTo(500, 1510);
  context.moveTo(740, 1510);
  context.lineTo(1130, 1510);
  context.stroke();
  context.fillStyle = '#334155';
  context.font = '500 24px Vazirmatn, Tahoma, sans-serif';
  context.fillText('امضا و مهر شرکت', 1130, 1555);
  context.fillText('امضای همکار', 500, 1555);
  context.fillStyle = '#64748b';
  context.font = '400 20px Vazirmatn, Tahoma, sans-serif';
  context.fillText('خروجی سامانه Rubi منابع انسانی', 1170, 1685);
  return canvas;
}

export async function downloadContractPdf(record: HrContractRecord): Promise<void> {
  const canvas = await renderContract(record);
  const jpegBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('ساخت تصویر قرارداد انجام نشد.'))),
      'image/jpeg',
      0.92,
    ),
  );
  const pdf = buildPdfFromJpeg(
    new Uint8Array(await jpegBlob.arrayBuffer()),
    canvas.width,
    canvas.height,
  );
  const blob = new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${record.number || 'hr-contract'}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
