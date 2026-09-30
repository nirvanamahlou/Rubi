import type { AffairsReport } from '../api/customer-affairs-client';
import {
  stageLabel,
  statusLabel,
  priorityLabel,
} from './customer-affairs-workspace';
import {
  buildSearchablePdf,
  type PdfPage,
  type PdfTextLine,
} from '@/lib/customer-affairs-pdf-core';

type PdfRow = { label: string; value: string; heading?: boolean };

export function reportPdfRows(report: AffairsReport): PdfRow[] {
  const count = (rows: Array<{ _count: { _all: number } }>) =>
    rows.reduce((sum, row) => sum + row._count._all, 0);
  return [
    { label: 'خلاصه', value: '', heading: true },
    { label: 'درخواست‌های مشتریان', value: String(count(report.leadStages)) },
    { label: 'تیکت‌های پشتیبانی', value: String(count(report.ticketStatuses)) },
    { label: 'پاسخ‌های رضایت‌سنجی', value: String(report.satisfaction.count) },
    {
      label: 'میانگین رضایت از ۵',
      value: report.satisfaction.average?.toFixed(1) ?? '—',
    },
    { label: 'وضعیت درخواست‌ها', value: '', heading: true },
    ...report.leadStages.map((row) => ({
      label: stageLabel[row.stage] ?? row.stage,
      value: String(row._count._all),
    })),
    { label: 'وضعیت تیکت‌ها', value: '', heading: true },
    ...report.ticketStatuses.map((row) => ({
      label: statusLabel[row.status] ?? row.status,
      value: String(row._count._all),
    })),
    { label: 'اولویت تیکت‌ها', value: '', heading: true },
    ...(report.ticketPriorities ?? []).map((row) => ({
      label: priorityLabel[row.priority] ?? row.priority,
      value: String(row._count._all),
    })),
    { label: 'دسته تیکت‌ها', value: '', heading: true },
    ...(report.ticketCategories ?? []).map((row) => ({
      label: row.category,
      value: String(row._count._all),
    })),
    { label: 'اقدام‌های اصلاحی', value: '', heading: true },
    ...report.correctiveActions.map((row) => ({
      label: row.status,
      value: String(row._count._all),
    })),
  ];
}

export async function downloadAffairsReportPdf(
  report: AffairsReport,
  dateRangeLabel: string,
) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ساخت PDF در این مرورگر پشتیبانی نمی‌شود.');
  const pages: PdfPage[] = [];
  let lines: PdfTextLine[] = [];
  let y = 0;
  const draw = (
    value: string,
    x: number,
    top: number,
    size: number,
    bold = false,
  ) => {
    context.font = `${bold ? '700' : '400'} ${size}px Vazirmatn, Tahoma, sans-serif`;
    context.fillText(value, x, top);
    lines.push({ text: value, x, y: top, size });
  };
  const start = () => {
    lines = [];
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#103c78';
    draw('خلاصه عملکرد امور مشتریان', 1160, 105, 36, true);
    context.fillStyle = '#687b93';
    draw(`بازه: ${dateRangeLabel}`, 1160, 160, 22);
    draw(
      `زمان تهیه: ${new Date(report.generatedAt).toLocaleString('fa-IR')}`,
      1160,
      200,
      20,
    );
    context.strokeStyle = '#2178d3';
    context.beginPath();
    context.moveTo(70, 238);
    context.lineTo(1170, 238);
    context.stroke();
    y = 285;
  };
  const save = () => {
    context.fillStyle = '#71839a';
    draw(`صفحه ${(pages.length + 1).toLocaleString('fa-IR')}`, 1160, 1680, 19);
    const binary = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]!);
    pages.push({
      image: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      width: canvas.width,
      height: canvas.height,
      lines: [...lines],
    });
  };
  start();
  for (const row of reportPdfRows(report)) {
    if (y > 1580) {
      save();
      start();
    }
    context.fillStyle = row.heading ? '#103c78' : '#26394d';
    draw(row.label, 1160, y, row.heading ? 27 : 23, row.heading);
    if (!row.heading) {
      context.textAlign = 'left';
      draw(row.value, 85, y, 23, true);
      context.textAlign = 'right';
    }
    y += row.heading ? 58 : 45;
  }
  save();
  const pdf = buildSearchablePdf(pages);
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `customer-affairs-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
