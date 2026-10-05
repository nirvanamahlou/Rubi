import { BadRequestException } from '@nestjs/common';
import {
  salesContractFlights,
  type SalesReservationRequestV1,
} from '@nora/contracts';

export interface IssuedTicketRow {
  id: string;
  contractNumber: string;
  passengerDisplayName: string;
  ticketNumber: string;
  pnr: null;
  originCityId: string;
  origin: string;
  destinationCityId: string;
  destination: string;
  airlineId: string;
  airline: string;
  issuedAt: string;
  departureAt: string;
  arrivalAt: string;
  direction: string;
  flightNumber: string;
  cabinClass: string;
  source: string;
  status: 'issued' | 'voided';
}
export function reportRange(query: Record<string, unknown>) {
  const day = (value: unknown) => {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('بازه تاریخ صدور معتبر را انتخاب کنید.');
    return value;
  };
  const from = day(query.issuedFrom),
    to = day(query.issuedTo);
  if (from > to) throw new BadRequestException('تاریخ پایان قبل از شروع است.');
  for (const [key, value] of Object.entries(query))
    if (key !== 'page' && (typeof value !== 'string' || value.length > 200))
      throw new BadRequestException('فیلتر نامعتبر است.');
  if (
    query.status &&
    !['all', 'issued', 'changed', 'refunded', 'voided'].includes(
      String(query.status),
    )
  )
    throw new BadRequestException('وضعیت نامعتبر است.');
  // Calendar filters represent local days in Tehran, not UTC receipt days.
  return {
    gte: new Date(from + 'T00:00:00+03:30'),
    lt: new Date(new Date(to + 'T00:00:00+03:30').valueOf() + 86400000),
  };
}
export function issuedRows(
  doc: {
    id: string;
    customerId: string;
    number: string;
    source: string;
    issuedAt: Date;
  },
  snapshot: SalesReservationRequestV1,
  cancelled: boolean,
): IssuedTicketRow[] {
  const passenger = snapshot.passengerAssignments?.find(
    (p) => p.customerId === doc.customerId,
  );
  if (!passenger || !snapshot.passengerIds.includes(doc.customerId)) return [];
  const seen = new Set<string>();
  return salesContractFlights(
    snapshot.serviceSelections,
    snapshot.ticketSelections ?? [],
  )
    .filter((f) => passenger.serviceClientKeys.includes(f.serviceClientKey))
    .flatMap((f) => {
      const key = [f.serviceClientKey, f.direction, f.departureAt].join(':');
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          id: doc.id + ':' + key,
          contractNumber: snapshot.contractNumber,
          passengerDisplayName:
            passenger.displayNameSnapshot?.trim() || 'نام مسافر ثبت نشده',
          ticketNumber: doc.number,
          pnr: null,
          originCityId: f.originId,
          origin: '',
          destinationCityId: f.destinationId,
          destination: '',
          airlineId: f.carrierNameSnapshot,
          airline: f.carrierNameSnapshot,
          issuedAt: doc.issuedAt.toISOString(),
          departureAt: f.departureAt,
          arrivalAt: f.arrivalAt,
          direction: f.direction,
          flightNumber: f.serviceNumberSnapshot,
          cabinClass: f.cabinClassCode,
          source: doc.source,
          status: cancelled ? ('voided' as const) : ('issued' as const),
        },
      ];
    });
}
export function filterIssuedRows(
  rows: IssuedTicketRow[],
  q: Record<string, unknown>,
) {
  const has = (value: string, term: unknown) =>
    !term ||
    value
      .toLocaleLowerCase('fa-IR')
      .includes(String(term).trim().toLocaleLowerCase('fa-IR'));
  return rows.filter(
    (r) =>
      has(
        [
          r.contractNumber,
          r.passengerDisplayName,
          r.ticketNumber,
          r.origin,
          r.destination,
          r.airline,
        ].join(' '),
        q.search,
      ) &&
      has(r.contractNumber, q.contractNumber) &&
      has(r.passengerDisplayName, q.passenger) &&
      has(r.ticketNumber, q.documentNumber) &&
      ['originCityId', 'destinationCityId', 'airlineId', 'status'].every(
        (k) =>
          !q[k] || q[k] === 'all' || r[k as keyof IssuedTicketRow] === q[k],
      ),
  );
}
export const issuedColumns: [keyof IssuedTicketRow, string][] = [
  ['contractNumber', 'شماره قرارداد'],
  ['passengerDisplayName', 'مسافر'],
  ['ticketNumber', 'شماره بلیط'],
  ['issuedAt', 'تاریخ صدور'],
  ['origin', 'مبدأ'],
  ['destination', 'مقصد'],
  ['direction', 'رفت / برگشت'],
  ['airline', 'ایرلاین'],
  ['flightNumber', 'شماره پرواز'],
  ['departureAt', 'زمان رفت'],
  ['arrivalAt', 'زمان رسیدن'],
  ['cabinClass', 'کلاس'],
  ['source', 'نوع صدور'],
  ['status', 'وضعیت'],
];
export function issuedValues(rows: IssuedTicketRow[]) {
  return rows.map((r) =>
    issuedColumns.map(([key]) => {
      const v = r[key] ?? '';
      if (['issuedAt', 'departureAt', 'arrivalAt'].includes(key))
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tehran',
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(v));
      if (key === 'direction') return v === 'OUTBOUND' ? 'رفت' : 'برگشت';
      if (key === 'status') return v === 'voided' ? 'ابطال شده' : 'صادرشده';
      if (key === 'source') return v === 'AUTO' ? 'خودکار' : 'دستی';
      return v;
    }),
  );
}
