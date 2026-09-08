import { z } from 'zod';
import type { LoginResponse } from '@rubi/contracts';
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
        status: z.literal('QUEUED'),
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
      return {
        id: row.id,
        contractNumber: snapshot.contractNumber,
        branchId: row.branchId,
        branchName:
          session.user.branches.find((b) => b.id === row.branchId)?.name ?? '—',
        issuerName: '—',
        customerName: '—',
        salesCounter: '—',
        assignee: null,
        passengerNames: (snapshot.passengerAssignments ?? []).flatMap((p) =>
          p.displayNameSnapshot ? [p.displayNameSnapshot] : [],
        ),
        services,
        priority: 'UNSPECIFIED',
        deadline: null,
        createdAt: snapshot.createdAt,
        receivedAt: row.receivedAt,
        ...(travelDate ? { travelDate } : {}),
        ...(snapshot.hotelSelection
          ? { hotelName: snapshot.hotelSelection.hotelNameSnapshot }
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
        status: 'NEW',
        issues: [],
      };
    });
}
export async function loadIntake(
  baseUrl: string,
  session: LoginResponse,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<RequestView[]> {
  const response = await fetcher(`${baseUrl}/reservations/requests`, {
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    headers: { accept: 'application/json' },
  });
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
  return decodeIntake(input, session);
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
