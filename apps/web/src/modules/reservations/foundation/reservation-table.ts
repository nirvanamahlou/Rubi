import type { RequestView } from './model';
import { serviceLabels, statusLabels } from './model';
export const reservationColumns = [
  'شماره قرارداد',
  'مقصد',
  'HOTEL',
  'CHECK IN',
  'CHECK OUT',
  'SGL',
  'DBL',
  'EXT',
  'SUIT',
  'تعداد اتاق',
  'اقدام هتل',
  'تأیید هتل',
  'اصلاح',
  'تاریخ اصلاح',
  'خدمات',
  'فروشنده',
  'طرف قرارداد',
  'سرویس هتل',
  'توضیحات هتل',
  'وضعیت',
] as const;
export function tableDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: value.length === 10 ? 'UTC' : 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function reservationCells(row: RequestView): string[] {
  return [
    row.contractNumber,
    row.destination ?? '—',
    row.hotelName ?? '—',
    tableDate(row.checkIn),
    tableDate(row.checkOut),
    String(row.singleRooms ?? '—'),
    String(row.doubleRooms ?? '—'),
    String(row.extraBeds ?? '—'),
    '—',
    String(row.roomCount ?? '—'),
    row.hotelRequested ? '✓' : '—',
    row.hotelConfirmed ? '✓' : '—',
    row.correctedAt ? '✓' : '—',
    tableDate(row.correctedAt),
    row.serviceTitles?.join('، ') ||
      row.services.map((kind) => serviceLabels[kind]).join('، ') ||
      '—',
    row.salesCounter || '—',
    row.customerName || '—',
    row.mealServiceName || '—',
    row.hotelNotes || '—',
    statusLabels[row.status],
  ];
}
export function reservationExportRows(rows: readonly RequestView[]) {
  return [[...reservationColumns], ...rows.map(reservationCells)];
}
