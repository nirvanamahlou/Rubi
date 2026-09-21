'use client';

import { z } from 'zod';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { masterDataApi } from '@/modules/master-data/api/client';
import type {
  IssuedTicketReadModel,
  IssuedTicketStatus,
} from '../model/issued-tickets';

const id = z.string().min(1).max(160);
const instant = z.string().datetime({ offset: true });
const reservationRowSchema = z.object({
  id,
  contractVersion: z.number().int().positive(),
  receivedAt: instant,
  workflow: z
    .object({
      supplierStatus: z.enum(['NEW', 'REQUESTED', 'CONFIRMED', 'CANCELLED']),
    })
    .nullable()
    .optional(),
  snapshot: z.object({
    contractNumber: z.string().min(1).max(100),
    passengerAssignments: z
      .array(
        z.object({
          customerId: id,
          displayNameSnapshot: z.string().max(200).optional(),
          serviceClientKeys: z.array(id).max(1000),
        }),
      )
      .max(1000)
      .optional(),
    serviceSelections: z
      .array(
        z.object({
          clientKey: id,
          kind: z.string().max(40),
        }),
      )
      .max(1000),
    ticketSelections: z
      .array(
        z.object({
          serviceClientKey: id,
          direction: z.enum(['OUTBOUND', 'RETURN']),
          offerId: id,
          originId: id,
          destinationId: id,
          departureAt: instant,
          carrierNameSnapshot: z.string().min(1).max(200),
        }),
      )
      .max(1000)
      .optional(),
  }),
});
const responseSchema = z.object({
  data: z.array(reservationRowSchema).max(100),
});
export type ReservationIssuedTicketSourceRow = z.infer<
  typeof reservationRowSchema
>;

const statusOf = (row: ReservationIssuedTicketSourceRow): IssuedTicketStatus =>
  row.workflow?.supplierStatus === 'CANCELLED' ? 'voided' : 'issued';

export function projectReservationIssuedTickets(
  rows: readonly ReservationIssuedTicketSourceRow[],
  cityNames: Readonly<Record<string, string>>,
): IssuedTicketReadModel[] {
  return rows.flatMap((row) => {
    const selections = row.snapshot.ticketSelections ?? [];
    return (row.snapshot.passengerAssignments ?? []).flatMap((passenger) => {
      const flightKeys = new Set(
        row.snapshot.serviceSelections
          .filter(
            (service) =>
              service.kind === 'FLIGHT' &&
              passenger.serviceClientKeys.includes(service.clientKey),
          )
          .map((service) => service.clientKey),
      );
      return selections
        .filter((ticket) => flightKeys.has(ticket.serviceClientKey))
        .map((ticket) => ({
          id: [
            row.id,
            passenger.customerId,
            ticket.offerId,
            ticket.direction,
          ].join(':'),
          contractNumber: row.snapshot.contractNumber,
          passengerDisplayName:
            passenger.displayNameSnapshot?.trim() || 'نام مسافر ثبت نشده',
          ticketNumber: null,
          pnr: null,
          originCityId: ticket.originId,
          origin: cityNames[ticket.originId] || 'نام شهر ثبت نشده',
          destinationCityId: ticket.destinationId,
          destination: cityNames[ticket.destinationId] || 'نام شهر ثبت نشده',
          airlineId: ticket.carrierNameSnapshot,
          airline: ticket.carrierNameSnapshot,
          issuedAt: row.receivedAt,
          departureAt: ticket.departureAt,
          status: statusOf(row),
        }));
    });
  });
}

async function reservationPage(
  page: number,
  signal: AbortSignal,
  retried = false,
) {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const response = await fetch(`${base}/reservations/requests?page=${page}`, {
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: { accept: 'application/json' },
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return reservationPage(page, signal, true);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      body?.message ||
        (response.status === 403
          ? 'مجوز مشاهده رزرواسیون وجود ندارد.'
          : 'دریافت بلیط‌های رزرواسیون انجام نشد.'),
    );
  }
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('پاسخ بلیط‌های رزرواسیون معتبر نیست.');
  return parsed.data.data;
}

export async function loadReservationIssuedTickets(signal: AbortSignal) {
  const rows: ReservationIssuedTicketSourceRow[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const current = await reservationPage(page, signal);
    rows.push(...current);
    if (current.length < 100) break;
    if (page === 100)
      throw new Error('تعداد رکوردها بیش از محدودهٔ گزارش است.');
  }
  const cityIds = [
    ...new Set(
      rows.flatMap((row) =>
        (row.snapshot.ticketSelections ?? []).flatMap((ticket) => [
          ticket.originId,
          ticket.destinationId,
        ]),
      ),
    ),
  ];
  const names = await Promise.all(
    cityIds.map(async (cityId) => {
      try {
        const { data } = await masterDataApi.detail('cities', cityId);
        return [cityId, data.name] as const;
      } catch {
        return [cityId, 'نام شهر ثبت نشده'] as const;
      }
    }),
  );
  return projectReservationIssuedTickets(rows, Object.fromEntries(names));
}
