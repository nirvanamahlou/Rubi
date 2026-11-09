import type { ServiceReportRow } from './service-report';
import { buildIssuedTicketWorkbook } from './issued-ticket-workbook';

/** UTC instants are displayed in the catalogue's defined Tehran calendar. Stay dates are date-only. */
export function reportGregorianTime(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    calendar: 'gregory',
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}
const kinds: Record<string, string> = {
  FLIGHT: 'پرواز',
  HOTEL: 'هتل',
  TRANSFER: 'ترانسفر',
  INSURANCE: 'بیمه',
  VISA: 'ویزا',
  TOUR: 'تور',
  TRAIN: 'قطار',
  BUS: 'اتوبوس',
  CIP: 'CIP',
  OTHER: 'سایر',
};
const columns = [
  ['contractNumber', 'شماره قرارداد'],
  ['passengerDisplayName', 'مسافر'],
  ['passengerCount', 'تعداد مسافران قرارداد در گزارش'],
  ['serviceKind', 'نوع خدمت'],
  ['serviceTitle', 'خدمت'],
  ['reportStatus', 'وضعیت خدمت'],
  ['ticketNumber', 'شماره بلیط'],
  ['pnr', 'PNR'],
  ['issuedAt', 'تاریخ صدور / ثبت درخواست'],
  ['origin', 'مبدأ'],
  ['destination', 'مقصد'],
  ['departureAt', 'تاریخ و ساعت حرکت / خدمت'],
  ['arrivalAt', 'تاریخ و ساعت رسیدن'],
  ['airline', 'ایرلاین'],
  ['flightNumber', 'شماره پرواز'],
  ['direction', 'رفت / برگشت'],
  ['cabinClass', 'کلاس'],
  ['source', 'نوع صدور'],
  ['hotelName', 'هتل'],
  ['checkInDate', 'تاریخ چک این هتل'],
  ['checkOutDate', 'تاریخ چک اوت هتل'],
  ['nights', 'تعداد شب اقامت'],
] as const;

export function buildServiceReportWorkbook(
  rows: ServiceReportRow[],
  query: Record<string, unknown>,
) {
  // Names are never identity keys: different passengers can have the same name.
  const identity = (r: ServiceReportRow) => r.customerId || r.id;
  const passengers = new Set(rows.map(identity));
  const contracts = new Map<string, Set<string>>();
  for (const r of rows) {
    const group = contracts.get(r.contractNumber) ?? new Set<string>();
    group.add(identity(r));
    contracts.set(r.contractNumber, group);
  }
  const count = (status: string) =>
    String(rows.filter((r) => r.reportStatus === status).length);
  const summary = [
    ['گزارش خدمات مسافران', 'خلاصه بر اساس تمام ردیف‌های منطبق با فیلترها'],
    [
      'بازه گزارش (میلادی)',
      `${String(query.issuedFrom ?? '')} تا ${String(query.issuedTo ?? '')}`,
    ],
    [
      'مبنای تاریخ',
      query.dateBasis === 'TRAVEL' ? 'حرکت / ورود هتل' : 'صدور / ثبت درخواست',
    ],
    ['تعداد مسافر یکتا', String(passengers.size)],
    ['تعداد قرارداد', String(contracts.size)],
    ['تعداد خدمات مسافران', String(rows.length)],
    ['خدمات صادرشده', count('ISSUED')],
    ['خدمات تخصیص‌یافته', count('ALLOCATED')],
    ['خدمات باطل‌شده', count('CANCELLED')],
    [
      'تعداد هتل',
      String(new Set(rows.map((r) => r.hotelId).filter(Boolean)).size),
    ],
    [
      'تاریخ و ساعت',
      'میلادی به وقت تعریف بلیت (تهران)؛ تاریخ اقامت بدون تبدیل منطقه زمانی',
    ],
    [],
  ];
  return buildIssuedTicketWorkbook(
    rows.map((r) =>
      columns.map(([key]) => {
        if (key === 'passengerCount')
          return String(contracts.get(r.contractNumber)?.size ?? 0);
        if (key === 'nights') {
          if (!r.checkInDate || !r.checkOutDate) return '';
          const nights =
            (Date.parse(r.checkOutDate) - Date.parse(r.checkInDate)) / 86400000;
          return Number.isInteger(nights) && nights >= 0 ? String(nights) : '';
        }
        const value = r[key] ?? '';
        if (['issuedAt', 'departureAt', 'arrivalAt'].includes(key))
          return reportGregorianTime(value);
        if (key === 'serviceKind') return kinds[value] ?? value;
        if (key === 'reportStatus')
          return value === 'ALLOCATED'
            ? 'تخصیص‌یافته'
            : value === 'CANCELLED'
              ? 'باطل‌شده'
              : 'صادرشده';
        if (key === 'direction')
          return value === 'OUTBOUND'
            ? 'رفت'
            : value === 'RETURN'
              ? 'برگشت'
              : '';
        if (key === 'source')
          return value === 'AUTO'
            ? 'خودکار'
            : value === 'MANUAL'
              ? 'دستی'
              : value;
        return value;
      }),
    ),
    columns.map(([, label]) => label),
    summary,
  );
}
