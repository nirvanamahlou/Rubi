import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardSourceQuery } from '../common/dashboard-source';
import { readTicketDashboard } from '../ticket-catalog/ticket-dashboard.public';
import { readSalesDashboardActivity } from '../sales/sales-dashboard-activity.public';
import { readHrDashboard } from '../hr/hr-dashboard.public';
import { readSupportDashboard } from '../customer-affairs/support-dashboard.public';
import { readDocumentDashboard } from '../documents/document-dashboard.public';
import { readReservationDashboard } from '../reservations/reservation-dashboard.public';
import { CallCenterDashboardSource } from '../customer-affairs/call-center-dashboard.public';

const query: DashboardSourceQuery = {
  actor: {
    userId: 'actor',
    branchIds: ['branch'],
    permissions: [
      'ticket_catalog.read',
      'sales.contracts.read.own',
      'hr.read',
      'customer_affairs.ticket.read',
      'documents.list',
      'reservations.read',
      'customer_affairs.call_center.read',
    ],
  },
  from: new Date('2026-10-01'),
  to: new Date('2026-11-01'),
  filters: {},
  dateBasis: 'effective',
};
const at = new Date('2026-10-15');
describe('audited native Dashboard activation', () => {
  it.each([
    readTicketDashboard,
    readSalesDashboardActivity,
    readHrDashboard,
    readSupportDashboard,
    readDocumentDashboard,
    readReservationDashboard,
  ])(
    'denies an unauthorized producer before querying its tables',
    async (read) => {
      expect(
        await read({} as never, {
          ...query,
          actor: { ...query.actor, permissions: [] },
        }),
      ).toMatchObject({ state: 'forbidden', metrics: {} });
    },
  );
  it.each([
    readTicketDashboard,
    readSalesDashboardActivity,
    readHrDashboard,
    readSupportDashboard,
    readDocumentDashboard,
    readReservationDashboard,
  ])(
    'does not silently discard an unsupported provider filter',
    async (read) => {
      expect(
        await read({} as never, { ...query, filters: { provider: 'other' } }),
      ).toMatchObject({ state: 'unsupported', metrics: {} });
    },
  );
  it('separates allocations from valid holds and never invents a low-capacity threshold', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'flight',
          departureAt: at,
          createdAt: at,
          carrierName: 'Air',
          serviceNumber: '1',
          totalCapacity: 10,
          status: 'ACTIVE',
          capacityAllocations: [{ quantity: 6, createdAt: at }],
          capacityHolds: [{ quantity: 2, createdAt: at }],
        },
      ])
      .mockResolvedValueOnce([
        { id: 'flight', originId: 'a', destinationId: 'b' },
      ]);
    const result = await readTicketDashboard(
      {
        ticketPublishedOffer: { findMany },
        masterCity: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
          ]),
        },
      } as never,
      query,
    );
    expect(result.metrics['remaining-capacity']?.observations[0]?.value).toBe(
      '4',
    );
    expect(result.metrics['inventory-free']?.observations[0]?.value).toBe('2');
    expect(result.metrics['sell-through-rate']?.observations[0]?.value).toBe(
      '60',
    );
    expect(result.metrics['remaining-capacity']?.snapshot).toBe(true);
    expect(result.metrics['low-capacity-offers']).toBeUndefined();
    expect(findMany.mock.calls[0]![0].where.branchId).toEqual({
      in: ['branch'],
    });
    expect(findMany.mock.calls[0]![0].select.capacityHolds.where.status).toBe(
      'ACTIVE',
    );
  });
  it('counts cancellation events on their event date and deduplicates contract/hotel while retaining independent stays', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        ownerUserId: 'owner',
        createdAt: new Date('2026-01-01'),
        confirmedAt: at,
        status: 'COMPLETED',
        statusHistory: [{ changedAt: at }],
        hotelSelection: {
          hotelId: 'hotel',
          hotelNameSnapshot: 'Hotel',
          checkInDate: new Date('2026-10-01'),
          checkOutDate: new Date('2026-10-03'),
          additionalStays: [
            {
              hotelId: 'hotel',
              hotelNameSnapshot: 'Hotel',
              checkInDate: new Date('2026-10-03'),
              checkOutDate: new Date('2026-10-07'),
            },
          ],
        },
      },
    ]);
    const result = await readSalesDashboardActivity(
      {
        salesContract: { findMany },
        branch: { findMany: vi.fn().mockResolvedValue([]) },
        user: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: 'owner', displayName: 'Expert' }]),
        },
      } as never,
      query,
    );
    expect(result.metrics['cancelled-orders']?.observations).toEqual([
      expect.objectContaining({
        at,
        value: '1',
        dimensions: { agent: 'Expert' },
      }),
    ]);
    expect(result.metrics['employee-contract-count']?.observations).toEqual([]);
    expect(result.metrics['hotel-reservations']?.observations).toHaveLength(1);
    expect(
      result.metrics['average-stay-length']?.observations.map((r) => r.value),
    ).toEqual(['2', '4']);
    const where = findMany.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).toContain('ownerUserId');
    expect(JSON.stringify(where)).toContain('changedAt');
    expect(JSON.stringify(result)).not.toContain('owner"');
  });
  it('uses the latest employee/day record, never reviving a superseded accepted day or counting pending/absent minutes', async () => {
    const row = (
      id: string,
      employeeId: string,
      status: string,
      updated: number,
    ) => ({
      id,
      employeeId,
      effectiveAt: at,
      updatedAt: new Date(at.getTime() + updated),
      status,
      data: { workedMinutes: 480, overtimeMinutes: 90 },
      employee: { unit: 'Unit' },
    });
    const result = await readHrDashboard(
      {
        hrRecord: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              row('a', 'one', 'حاضر', 1),
              row('b', 'one', 'نیازمند بررسی', 2),
              row('c', 'two', 'حاضر', 1),
              row('d', 'two', 'حاضر', 2),
              row('e', 'three', 'غایب', 1),
            ]),
        },
      } as never,
      query,
    );
    expect(result.metrics['employee-workdays']?.observations).toHaveLength(1);
    expect(result.metrics['employee-overtime']?.observations[0]?.value).toBe(
      '1.5',
    );
    expect(result.metrics['employee-overtime']?.unit).toBe('ساعت');
  });
  it.each(['workedMinutes', 'overtimeMinutes'])(
    'withholds incomplete accepted attendance instead of inventing zero for missing %s',
    async (field) => {
      const data: Record<string, number> = {
        workedMinutes: 480,
        overtimeMinutes: 90,
      };
      delete data[field];
      const result = await readHrDashboard(
        {
          hrRecord: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'day',
                employeeId: 'employee',
                branchId: 'branch',
                effectiveAt: at,
                updatedAt: at,
                status: 'حاضر',
                data,
                employee: { unit: 'Unit' },
              },
            ]),
          },
        } as never,
        query,
      );
      expect(result.metrics['employee-overtime']).toBeUndefined();
      expect(result.unavailableMetrics?.['employee-overtime']).toBe(
        'MEASUREMENT_INPUTS_REQUIRED',
      );
      if (field === 'workedMinutes')
        expect(result.metrics['employee-workdays']).toBeUndefined();
      else
        expect(result.metrics['employee-workdays']?.observations).toHaveLength(
          1,
        );
    },
  );
  it('excludes internal ticket categories and leaves missing first response unavailable rather than zero minutes', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { createdAt: at, status: 'NEW', firstRespondedAt: null },
      { createdAt: at, status: 'CLOSED', firstRespondedAt: null },
    ]);
    const result = await readSupportDashboard(
      { customerAffairsTicket: { findMany } } as never,
      query,
    );
    expect(result.metrics['open-tickets']?.observations).toHaveLength(1);
    expect(result.metrics['first-response-time']?.observations).toEqual([]);
    expect(findMany.mock.calls[0]![0].where.NOT).toEqual([
      { category: 'CALL_CENTER_REQUEST' },
      { category: { startsWith: 'WORKBENCH_' } },
    ]);
  });
  it('inherits native Call Center authorization and withholds incomplete manual attribution', async () => {
    const report = vi.fn().mockResolvedValue({
      data: {
        groups: [{ origin: 'TELEPHONY', count: 3 }],
        expertActivity: {
          rows: [
            {
              id: 'expert',
              name: 'Expert',
              total: 3,
              inboundAnswered: 1,
              outboundConnected: 1,
            },
          ],
        },
      },
    });
    const source = new CallCenterDashboardSource({ report } as never);
    const result = await source.read(query);
    expect(result.metrics['employee-call-count']?.observations[0]?.value).toBe(
      '3',
    );
    expect(
      result.metrics['employee-connected-call-count']?.observations[0]?.value,
    ).toBe('2');
    expect(report.mock.calls[0]![0].permissions).toEqual(
      query.actor.permissions,
    );
    expect(report.mock.calls[0]![1]).toBe('branch');
    report.mockResolvedValue({
      data: {
        groups: [{ origin: 'MANUAL', count: 1 }],
        expertActivity: { rows: [] },
      },
    });
    expect(await source.read(query)).toMatchObject({
      state: 'unsupported',
      reason: 'MANUAL_CALL_ATTRIBUTION_REQUIRED',
      metrics: {},
    });
    report.mockRejectedValue(new ForbiddenException('scope denied'));
    expect(await source.read(query)).toMatchObject({
      state: 'forbidden',
      metrics: {},
    });
    report.mockRejectedValue(new Error('scope denied'));
    await expect(source.read(query)).rejects.toThrow('scope denied');
  });
});
