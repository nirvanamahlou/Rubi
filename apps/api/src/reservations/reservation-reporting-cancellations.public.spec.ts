import { describe, it, expect, vi } from 'vitest';
import type { DatabaseClient } from '@nora/database';
import { readReservationReportingCancellations } from './reservation-reporting-cancellations.public';

describe('current Reservations cancellation projection', () => {
  it('reads only supplied authorized IDs and the latest workflow of the latest intake', async () => {
    const at = new Date('2026-11-03T10:00:00Z');
    const findMany = vi.fn().mockResolvedValue([
      {
        contractId: 'cancelled',
        workflowRevisions: [
          { state: { supplierStatus: 'CANCELLED' }, createdAt: at },
        ],
      },
      {
        contractId: 'reopened',
        workflowRevisions: [
          { state: { supplierStatus: 'NEW' }, createdAt: at },
        ],
      },
    ]);
    const result = await readReservationReportingCancellations(
      { reservationIntake: { findMany } } as unknown as DatabaseClient,
      ['cancelled', 'reopened'],
    );
    expect([...result.keys()]).toEqual(['cancelled']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contractId: { in: ['cancelled', 'reopened'] } },
        distinct: ['contractId'],
        orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
        select: expect.objectContaining({
          workflowRevisions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { state: true, createdAt: true },
          },
        }),
      }),
    );
  });
  it('does not query when there are no authorized contracts', async () => {
    expect(
      await readReservationReportingCancellations({} as DatabaseClient, []),
    ).toEqual(new Map());
  });
});
