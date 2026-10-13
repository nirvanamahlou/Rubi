import type { RequestView } from './model';
import { reservationDay, serviceLabels } from './model';
export const reservationColumns = [
  'شماره قرارداد',
  'مقصد',
  'Hotel',
  'Check in',
  'Check out',
  'SGL',
  'DBL',
  'EXT',
  'تعداد اتاق',
  'اقدام هتل',
  'تأیید هتل',
  'اصلاح',
  'تاریخ اصلاح',
  'خدمات',
  'فروشنده',
  'طرف قرارداد',
  'سرویس هتل',
  'ترانسفر',
  'راهنما',
  'مدت روز',
  'مدت شب',
  'تعداد مسافر',
  'درجه هتل',
  'گشت',
  'تعداد بزرگسال',
  'تعداد کودک ۲ تا ۶',
  'تعداد کودک ۶ تا ۱۲',
  'تعداد نوزاد زیر ۲ سال',
  'اقدام ویزا',
  'تأیید ویزا',
  'اقدام پرواز',
  'تأیید پرواز',
  'تاریخ ثبت قرارداد',
  'تاریخ رفت',
  'تاریخ برگشت',
  'نوع بلیط',
  'قیمت فروش ریالی',
  'قیمت فروش ارزی',
  'نوع ارز',
  'تخفیف',
  'کمیسیون',
  'قیمت تمام‌شده',
  'بدهکار ریالی',
  'بدهکاری ارزی',
  'ابطال',
  'تاریخ ابطال',
] as const;
export function tableDate(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: value.length === 10 ? 'UTC' : 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function reservationCells(row: RequestView): string[] {
  const s = row.tableSummary;
  const start = reservationDay(
    row.checkIn ?? s?.departureDate ?? row.travelDate,
  );
  const end = reservationDay(row.checkOut ?? s?.returnDate ?? undefined);
  const nights =
    start && end ? (Date.parse(end) - Date.parse(start)) / 86400000 : undefined;
  const validNights = nights !== undefined && nights >= 0 ? nights : undefined;
  const number = (value: number | undefined) => String(value ?? '—');
  const text = (value: string | null | undefined) => value || '—';
  const tick = (value: unknown) => (value ? '✓' : '—');
  return [
    row.contractNumber,
    text(row.destination),
    text(row.hotelName),
    tableDate(row.checkIn),
    tableDate(row.checkOut),
    number(row.singleRooms),
    number(row.doubleRooms),
    number(row.extraBeds),
    number(row.roomCount),
    tick(row.hotelRequested),
    tick(row.hotelConfirmed),
    tick(s?.correctedAt ?? row.correctedAt),
    tableDate(s?.correctedAt ?? row.correctedAt),
    row.serviceTitles?.join('، ') ||
      row.services.map((k) => serviceLabels[k]).join('، ') ||
      '—',
    text(row.salesCounter),
    text(row.customerName),
    text(row.mealServiceName),
    text(row.transfer),
    text(row.guide),
    number(validNights === undefined ? undefined : validNights + 1),
    number(validNights),
    number(s?.passengerCount),
    text(row.hotelStars),
    text(row.excursion),
    number(s?.adults),
    number(s?.children2To6),
    number(s?.children6To12),
    number(s?.infants),
    tick(row.tableFlags?.visaRequested?.checked),
    tick(row.tableFlags?.visaConfirmed?.checked),
    tick(row.tableFlags?.flightRequested?.checked),
    tick(row.tableFlags?.flightConfirmed?.checked),
    tableDate(s?.createdAt ?? row.createdAt),
    tableDate(s?.departureDate ?? row.travelDate),
    tableDate(s?.returnDate),
    text(row.ticketKind),
    text(s?.saleRial),
    text(s?.saleForeign),
    text(s?.currencies),
    text(s?.discount),
    text(s?.commission),
    text(row.cost),
    text(s?.debtRial),
    text(s?.debtForeign),
    tick(s?.cancelledAt),
    tableDate(s?.cancelledAt),
  ];
}
export function reservationExportRows(rows: readonly RequestView[]) {
  return [[...reservationColumns], ...rows.map(reservationCells)];
}
