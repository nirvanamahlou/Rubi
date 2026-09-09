import { describe, expect, it, vi } from 'vitest';
import type { LoginResponse } from '@rubi/contracts';
import {
  decodeIntake,
  loadIntake,
  ReservationArrivalTracker,
} from './live-feed';
import {
  defaultQuery,
  queryRows,
  reservationDay,
  validateDateRange,
  dashboard,
} from './model';
const session = {
  user: {
    id: 'user',
    permissions: ['reservations.read'],
    branches: [{ id: 'a', name: 'Test', code: 'A' }],
  },
} as unknown as LoginResponse;
function intake(id = 'one', receivedAt = '2026-09-08T09:00:00Z') {
  return {
    id,
    requestId: id,
    contractId: 'contract',
    contractVersion: 1,
    branchId: 'a',
    status: 'QUEUED',
    receivedAt,
    snapshot: {
      version: 1,
      requestId: id,
      contractId: 'contract',
      contractNumber: 'TEST',
      contractVersion: 1,
      customerId: 'customer',
      createdAt: '2026-09-07T21:00:00Z',
      passengerIds: [],
      serviceSelections: [{ kind: 'HOTEL', titleSnapshot: 'Test hotel' }],
      hotelSelection: null,
    },
  };
}
const envelope = (data = [intake()]) => ({ version: 1, data });
const row = (id = 'one', time?: string) =>
  decodeIntake(envelope([intake(id, time)]), session)[0]!;
describe('reservation feed boundary', () => {
  it('keeps real values without inventing priority, deadline or customer name', () => {
    expect(row()).toMatchObject({
      status: 'NEW',
      priority: 'UNSPECIFIED',
      deadline: null,
      customerName: '—',
      branchName: 'Test',
    });
  });
  it('excludes another branch', () => {
    expect(
      decodeIntake(envelope([{ ...intake(), branchId: 'other' }]), session),
    ).toEqual([]);
  });
  it('rejects missing permission', () => {
    expect(() =>
      decodeIntake(envelope(), {
        ...session,
        user: { ...session.user, permissions: [] },
      }),
    ).toThrow('FORBIDDEN');
  });
  it('rejects duplicate and mismatching identities', () => {
    expect(() => decodeIntake(envelope([intake(), intake()]), session)).toThrow(
      'ERROR',
    );
    expect(() =>
      decodeIntake(envelope([{ ...intake(), contractVersion: 2 }]), session),
    ).toThrow('ERROR');
  });
  it('rejects unrecognized operational states instead of showing them as new', () => {
    expect(() =>
      decodeIntake(envelope([{ ...intake(), status: 'CANCELLED' }]), session),
    ).toThrow('ERROR');
  });
  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_CONFIGURED'],
    [500, 'ERROR'],
  ])('maps HTTP %s safely', async (status, state) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: Number(status) }));
    await expect(
      loadIntake(
        'https://example.test/api/v1',
        session,
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow(String(state));
  });
  it('uses authenticated uncached public reads', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(envelope()));
    expect(
      await loadIntake(
        'https://example.test/api/v1',
        session,
        new AbortController().signal,
        fetcher,
      ),
    ).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/api/v1/reservations/requests',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
});
describe('arrival notifications', () => {
  it('does not notify initial data, repeated reads or older window entries', () => {
    const tracker = new ReservationArrivalTracker();
    expect(tracker.observe([row()])).toBe(0);
    expect(tracker.observe([row()])).toBe(0);
    expect(tracker.observe([row('two', '2026-09-08T09:01:00Z'), row()])).toBe(
      1,
    );
    expect(
      tracker.observe([
        row('older', '2026-09-08T08:00:00Z'),
        row('two', '2026-09-08T09:01:00Z'),
      ]),
    ).toBe(0);
  });
  it('counts equal-time arrivals once and supports an initially empty inbox', () => {
    const tracker = new ReservationArrivalTracker();
    expect(tracker.observe([])).toBe(0);
    expect(tracker.observe([row(), row('two')])).toBe(2);
    expect(tracker.observe([row('three'), row(), row('two')])).toBe(1);
    expect(tracker.observe([row('three')])).toBe(0);
  });
});
describe('date and state filters', () => {
  it('includes both Tehran day boundaries and excludes adjacent instants', () => {
    const times = [
      '2026-09-07T20:29:59Z',
      '2026-09-07T20:30:00Z',
      '2026-09-08T20:29:59Z',
      '2026-09-08T20:30:00Z',
    ];
    const rows = times.map((time, index) => row(String(index), time));
    expect(
      queryRows(rows, {
        ...defaultQuery,
        dateBasis: 'receivedAt',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
      }).rows.map((r) => r.id),
    ).toEqual(['1', '2']);
  });
  it('combines status and travel date; excludes unavailable dates', () => {
    const rows = [
      {
        ...row('cancel'),
        travelDate: '2026-09-08',
        status: 'CANCELLED' as const,
      },
      { ...row('new'), travelDate: '2026-09-08' },
      row('unknown'),
    ];
    expect(
      queryRows(rows, {
        ...defaultQuery,
        dateBasis: 'travelDate',
        fromDate: '2026-09-08',
        status: 'CANCELLED',
      }).rows.map((r) => r.id),
    ).toEqual(['cancel']);
    expect(dashboard(rows, '2026-09-08T09:00:00Z').nearSla).toBe(0);
  });
  it('rejects invalid/reversed ranges and does not guess timezone-less instants', () => {
    expect(validateDateRange('2026-02-30', '')).toBeTruthy();
    expect(validateDateRange('2026-09-09', '2026-09-08')).toBeTruthy();
    expect(
      queryRows([row()], { ...defaultQuery, fromDate: 'invalid' }).rows,
    ).toEqual([]);
    expect(reservationDay('2026-09-08T09:00:00')).toBeNull();
    expect(reservationDay('2026-09-08')).toBe('2026-09-08');
  });
});

it('loads following API pages for filtered export without truncating at 100', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () =>
        envelope(Array.from({ length: 100 }, (_, i) => intake(`page1-${i}`))),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => envelope([intake('page2')]),
    });
  const rows = await loadIntake(
    'http://example.test/api',
    session,
    new AbortController().signal,
    fetcher,
  );
  expect(rows).toHaveLength(101);
  expect(fetcher.mock.calls[1]?.[0]).toBe(
    'http://example.test/api/reservations/requests?page=2',
  );
});
it('projects the latest persisted arrangement over the commercial room snapshot', () => {
  const source = intake();
  const rows = decodeIntake(
    envelope([
      {
        ...source,
        snapshot: {
          ...source.snapshot,
          hotelSelection: {
            hotelNameSnapshot: 'Demo',
            checkInDate: '2026-10-01',
            checkOutDate: '2026-10-03',
            roomCount: 1,
            singleRoomCount: 1,
            doubleRoomCount: 0,
            extraBedCount: 0,
          },
        },
        arrangement: {
          roomCount: 2,
          singleRoomCount: 0,
          doubleRoomCount: 2,
          extraBedCount: 1,
          updatedAt: '2026-09-09T10:00:00Z',
        },
      } as never,
    ]),
    session,
  );
  expect(rows[0]).toMatchObject({
    roomCount: 2,
    singleRooms: 0,
    doubleRooms: 2,
    extraBeds: 1,
    correctedAt: '2026-09-09T10:00:00Z',
  });
});
