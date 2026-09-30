import { z } from 'zod';
import type { LoginResponse } from '@nora/contracts';
import {
  isCivilDate,
  type RequestView,
  type ViewAccess,
  type ViewState,
} from './model';

// Defensive adapter for the reviewed Sales PR #90 public HTTP response.
// Unknown fields are stripped; no shared-contract or intake implementation is copied.
const id = z.string().min(1).max(160);
const instant = z.string().datetime({ offset: true });
const flagSchema = z.object({
  checked: z.boolean(),
  updatedAt: instant,
  updatedByUserId: id,
  actorName: z.string().nullable().optional(),
});
const summarySchema = z.object({
  createdAt: instant,
  contractVersion: z.number().int().positive(),
  correctedAt: instant.nullable(),
  cancelledAt: instant.nullable(),
  departureDate: z.string(),
  returnDate: z.string().nullable(),
  passengerCount: z.number().int().nonnegative(),
  adults: z.number().int().nonnegative(),
  children2To6: z.number().int().nonnegative(),
  children6To12: z.number().int().nonnegative(),
  infants: z.number().int().nonnegative(),
  saleRial: z.string().nullable(),
  saleForeign: z.string().nullable(),
  currencies: z.string(),
  discount: z.string().nullable(),
  commission: z.string().nullable(),
  debtRial: z.string().nullable(),
  debtForeign: z.string().nullable(),
});
const snapshotSchema = z.object({
  version: z.literal(1),
  requestId: id,
  contractId: id,
  contractNumber: z.string().min(1).max(100),
  contractVersion: z.number().int().positive(),
  customerId: id,
  createdAt: instant,
  passengerIds: z.array(id).max(1000),
  passengerAssignments: z
    .array(
      z.object({
        customerId: id,
        displayNameSnapshot: z.string().max(200).optional(),
      }),
    )
    .max(1000)
    .optional(),
  serviceSelections: z
    .array(
      z.object({
        kind: z.string().max(40),
        titleSnapshot: z.string().max(300),
        metadata: z
          .object({
            reservationNote: z.string().max(500).optional(),
            notes: z.string().optional(),
          })
          .passthrough()
          .nullish(),
      }),
    )
    .max(1000),
  ticketSelections: z
    .array(
      z.object({
        departureAt: instant,
        carrierNameSnapshot: z.string().max(200),
        destinationId: id,
      }),
    )
    .max(1000)
    .optional(),
  hotelSelection: z
    .object({
      hotelNameSnapshot: z.string().max(200),
      hotelId: id.optional(),
      mealServiceId: id.nullable().optional(),
      cityId: id.optional(),
      checkOutDate: z.string().refine(isCivilDate).optional(),
      roomCount: z.number().int().nonnegative().optional(),
      singleRoomCount: z.number().int().nonnegative().optional(),
      doubleRoomCount: z.number().int().nonnegative().optional(),
      extraBedCount: z.number().int().nonnegative().optional(),
      checkInDate: z.string().refine(isCivilDate),
    })
    .nullable(),
});
const envelopeSchema = z.object({
  version: z.literal(1),
  data: z
    .array(
      z.object({
        id,
        requestId: id,
        contractId: id,
        contractVersion: z.number().int().positive(),
        branchId: id,
        sellerName: z.string().max(300).nullable().optional(),
        contractPartyName: z.string().max(300).nullable().optional(),
        status: z.literal('QUEUED'),
        arrangement: z
          .object({
            roomCount: z.number().int().nonnegative(),
            singleRoomCount: z.number().int().nonnegative(),
            doubleRoomCount: z.number().int().nonnegative(),
            extraBedCount: z.number().int().nonnegative(),
            updatedAt: instant,
            reason: z.string().max(1000).optional(),
          })
          .nullable()
          .optional(),
        workflow: z
          .object({
            version: z.number().int().nonnegative().optional(),
            tableFlags: z
              .object({
                visaRequested: flagSchema.optional(),
                visaConfirmed: flagSchema.optional(),
                flightRequested: flagSchema.optional(),
                flightConfirmed: flagSchema.optional(),
              })
              .optional(),
            voucherSettings: z
              .object({
                text: z.record(z.string(), z.string()),
                flags: z.record(z.string(), z.boolean()),
              })
              .passthrough()
              .optional(),
            supplierStatus: z.enum([
              'NEW',
              'REQUESTED',
              'CONFIRMED',
              'CANCELLED',
            ]),
            voucherIssued: z.boolean(),
            reservationNotes: z.array(z.string()).optional(),
          })
          .nullable()
          .optional(),
        tableSummary: summarySchema.nullish(),
        hotelPurchases: z
          .array(z.object({ amount: z.string(), currencyCode: z.string() }))
          .optional(),
        servicePurchases: z
          .array(
            z.object({
              serviceKind: z.string().optional(),
              amount: z.string(),
              currencyCode: z.string(),
            }),
          )
          .optional(),
        receivedAt: instant,
        snapshot: snapshotSchema,
      }),
    )
    .max(100),
});
export class ReservationFeedError extends Error {
  constructor(readonly state: ViewState) {
    super(state);
  }
}
export function accessFromSession(session: LoginResponse): ViewAccess {
  return {
    authenticated: true,
    permissions: [...session.user.permissions],
    branchIds: session.user.branches.map((b) => b.id),
  };
}
export function decodeIntake(
  input: unknown,
  session: LoginResponse,
): RequestView[] {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) throw new ReservationFeedError('ERROR');
  const access = accessFromSession(session);
  if (!access.permissions.includes('reservations.read'))
    throw new ReservationFeedError('FORBIDDEN');
  const seen = new Set<string>();
  return parsed.data.data
    .filter((r) => access.branchIds.includes(r.branchId))
    .map((row) => {
      if (
        seen.has(row.id) ||
        row.requestId !== row.snapshot.requestId ||
        row.contractId !== row.snapshot.contractId ||
        row.contractVersion !== row.snapshot.contractVersion
      )
        throw new ReservationFeedError('ERROR');
      seen.add(row.id);
      const snapshot = row.snapshot;
      const knownKinds = [
        'FLIGHT',
        'TRAIN',
        'BUS',
        'HOTEL',
        'INSURANCE',
        'OTHER',
      ] as const;
      const services = [
        ...new Set(
          snapshot.serviceSelections.map(
            (s) => knownKinds.find((k) => k === s.kind) ?? 'OTHER',
          ),
        ),
      ];
      const departures = (snapshot.ticketSelections ?? [])
        .map((t) => t.departureAt)
        .sort();
      const travelDate = departures[0] ?? snapshot.hotelSelection?.checkInDate;
      const metadata = snapshot.serviceSelections.map((s) => s.metadata);
      const meta = (key: string) =>
        metadata.find((m) => typeof m?.[key] === 'string')?.[key] as
          string | undefined;
      const settings = row.workflow?.voucherSettings;
      const purchases = new Map<string, bigint>();
      const costs = [
        ...(row.servicePurchases ?? []),
        ...((row.servicePurchases ?? []).some((p) => p.serviceKind === 'HOTEL')
          ? []
          : (row.hotelPurchases ?? [])),
      ];
      for (const cost of costs) {
        if (!/^\d+(?:\.\d{1,4})?$/.test(cost.amount)) continue;
        const [whole, fraction = ''] = cost.amount.split('.');
        purchases.set(
          cost.currencyCode,
          (purchases.get(cost.currencyCode) ?? 0n) +
            BigInt(whole!) * 10000n +
            BigInt(fraction.padEnd(4, '0')),
        );
      }
      return {
        tableSummary: row.tableSummary ?? undefined,
        tableFlags: row.workflow?.tableFlags,
        workflowVersion: row.workflow?.version,
        transfer:
          settings?.text.transferKind ||
          meta('transferKind') ||
          (snapshot.serviceSelections.some((s) => s.kind === 'TRANSFER')
            ? 'دارد'
            : undefined),
        guide:
          settings?.text.leaderName ||
          meta('tourLeader') ||
          (settings?.flags.tourLeader ? 'دارد' : undefined),
        excursion:
          settings?.text.excursionDescription ||
          meta('excursion') ||
          (settings?.flags.excursion ? 'دارد' : undefined),
        hotelStars: settings?.text.stars || undefined,
        ticketKind:
          [
            ...new Set(
              snapshot.serviceSelections
                .filter((s) => ['FLIGHT', 'TRAIN', 'BUS'].includes(s.kind))
                .map(
                  (s) =>
                    ({ FLIGHT: 'هواپیما', TRAIN: 'قطار', BUS: 'اتوبوس' })[
                      s.kind
                    ] ?? s.kind,
                ),
            ),
          ].join(' / ') || undefined,
        cost:
          [...purchases]
            .map(([currency, units]) => {
              const fraction = (units % 10000n)
                .toString()
                .padStart(4, '0')
                .replace(/0+$/, '');
              return (
                (units / 10000n).toString() +
                (fraction ? '.' + fraction : '') +
                ' ' +
                currency
              );
            })
            .join(' / ') || undefined,
        id: row.id,
        contractId: row.contractId,
        contractNumber: snapshot.contractNumber,
        branchId: row.branchId,
        branchName:
          session.user.branches.find((b) => b.id === row.branchId)?.name ?? '—',
        issuerName: '—',
        customerName: row.contractPartyName ?? '—',
        salesCounter: row.sellerName ?? '—',
        serviceTitles: snapshot.serviceSelections
          .map((s) => s.titleSnapshot)
          .filter(Boolean),
        mealServiceId: snapshot.hotelSelection?.mealServiceId ?? undefined,
        hotelNotes: row.arrangement?.reason,
        hasNotes:
          row.snapshot.serviceSelections.some(
            (service) =>
              !!(
                service.metadata?.reservationNote?.trim() ||
                service.metadata?.notes?.trim()
              ),
          ) || !!row.workflow?.reservationNotes?.length,
        assignee: null,
        passengerNames: (snapshot.passengerAssignments ?? []).flatMap((p) =>
          p.displayNameSnapshot ? [p.displayNameSnapshot] : [],
        ),
        services,
        priority: 'UNSPECIFIED',
        deadline: null,
        createdAt: snapshot.createdAt,
        receivedAt: row.receivedAt,
        destinationId:
          snapshot.hotelSelection?.cityId ??
          snapshot.ticketSelections?.[0]?.destinationId,
        checkIn: snapshot.hotelSelection?.checkInDate,
        checkOut: snapshot.hotelSelection?.checkOutDate,
        roomCount:
          row.arrangement?.roomCount ?? snapshot.hotelSelection?.roomCount,
        singleRooms:
          row.arrangement?.singleRoomCount ??
          snapshot.hotelSelection?.singleRoomCount,
        doubleRooms:
          row.arrangement?.doubleRoomCount ??
          snapshot.hotelSelection?.doubleRoomCount,
        extraBeds:
          row.arrangement?.extraBedCount ??
          snapshot.hotelSelection?.extraBedCount,
        hotelRequested: ['REQUESTED', 'CONFIRMED'].includes(
          row.workflow?.supplierStatus ?? '',
        ),
        hotelConfirmed: row.workflow?.voucherIssued === true,
        correctedAt: row.tableSummary?.correctedAt ?? undefined,
        ...(travelDate ? { travelDate } : {}),
        ...(snapshot.hotelSelection
          ? {
              hotelName: snapshot.hotelSelection.hotelNameSnapshot,
              hotelId: snapshot.hotelSelection.hotelId,
            }
          : {}),
        ...(snapshot.ticketSelections?.length
          ? {
              carrierName: [
                ...new Set(
                  snapshot.ticketSelections.map((t) => t.carrierNameSnapshot),
                ),
              ].join('، '),
            }
          : {}),
        status:
          row.tableSummary?.cancelledAt ||
          row.workflow?.supplierStatus === 'CANCELLED'
            ? 'CANCELLED'
            : row.workflow?.voucherIssued
              ? 'VOUCHER_ISSUED'
              : row.workflow?.supplierStatus === 'CONFIRMED'
                ? 'SUPPLIER_CONFIRMED'
                : row.workflow?.supplierStatus === 'REQUESTED'
                  ? 'WAITING_SUPPLIER'
                  : 'NEW',
        issues: [],
      };
    });
}
export async function loadIntake(
  baseUrl: string,
  session: LoginResponse,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  page = 1,
): Promise<RequestView[]> {
  const response = await fetcher(
    `${baseUrl}/reservations/requests${page > 1 ? `?page=${page}` : ''}`,
    {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      headers: { accept: 'application/json' },
    },
  );
  if (!response.ok)
    throw new ReservationFeedError(
      response.status === 401
        ? 'UNAUTHORIZED'
        : response.status === 403
          ? 'FORBIDDEN'
          : [404, 501, 503].includes(response.status)
            ? 'NOT_CONFIGURED'
            : 'ERROR',
    );
  let input: unknown;
  try {
    input = await response.json();
  } catch {
    throw new ReservationFeedError('ERROR');
  }
  const current = decodeIntake(input, session);
  const count = (input as { data: unknown[] }).data.length;
  if (count < 100) return current;
  if (page >= 100) throw new ReservationFeedError('ERROR');
  const rest = await loadIntake(baseUrl, session, signal, fetcher, page + 1);
  const combined = [...current, ...rest];
  if (new Set(combined.map((row) => row.id)).size !== combined.length)
    throw new ReservationFeedError('ERROR');
  return combined;
}
/** Constant-memory watermark except for IDs sharing the newest timestamp. No PII/storage. */
export class ReservationArrivalTracker {
  private initialized = false;
  private watermark = -Infinity;
  private newestIds = new Set<string>();
  observe(rows: readonly RequestView[]): number {
    const times = rows.map((row) => ({
      id: row.id,
      time: Date.parse(row.receivedAt ?? row.createdAt),
    }));
    const arrivals = this.initialized
      ? times.filter(
          (row) =>
            Number.isFinite(row.time) &&
            (row.time > this.watermark ||
              (row.time === this.watermark && !this.newestIds.has(row.id))),
        )
      : [];
    const newest = Math.max(
      this.watermark,
      ...times.filter((r) => Number.isFinite(r.time)).map((r) => r.time),
    );
    if (newest > this.watermark) this.newestIds.clear();
    times
      .filter((r) => r.time === newest)
      .forEach((r) => this.newestIds.add(r.id));
    this.watermark = newest;
    this.initialized = true;
    return new Set(arrivals.map((r) => r.id)).size;
  }
}
