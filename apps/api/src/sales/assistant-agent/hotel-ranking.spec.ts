import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '@nora/database';
import type { AgentScope } from './query.service';
import { readHotelRanking } from './hotel-ranking';

describe('authorized hotel ranking', () => {
  it('scopes contract selection, deduplicates stays and excludes reservation cancellations', async () => {
    const start = new Date('2026-10-23T00:00:00Z');
    const end = new Date('2026-11-23T00:00:00Z');
    const scope: AgentScope = {
      mode: 'own',
      userId: 'user-a',
      branchIds: ['branch-a'],
      companyId: 'company-a',
      payments: false,
    };
    const stay = {
      hotelId: 'hotel-a',
      cityId: 'city-a',
      hotelNameSnapshot: 'Hotel A',
    };
    const other = {
      hotelId: 'hotel-b',
      cityId: 'city-b',
      hotelNameSnapshot: 'Hotel B',
    };
    const findMany = vi.fn().mockResolvedValue([
      { ...stay, contractId: 'visible', additionalStays: [stay, other] },
      { ...stay, contractId: 'second', additionalStays: [] },
      { ...stay, contractId: 'cancelled', additionalStays: [other] },
    ]);
    const tx = {
      $executeRaw: vi.fn(),
      salesContractHotelSelection: { findMany },
      masterCity: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'city-a', country: { id: 'country-a', name: 'کشور الف' } },
          { id: 'city-b', country: { id: 'country-b', name: 'کشور ب' } },
        ]),
      },
      reservationIntake: {
        findMany: vi.fn().mockResolvedValue([
          {
            contractId: 'cancelled',
            workflowRevisions: [
              { state: { supplierStatus: 'CANCELLED' }, createdAt: end },
            ],
          },
        ]),
      },
    };
    const db = {
      $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    };
    const result = await readHotelRanking(
      db as unknown as DatabaseClient,
      scope,
      start,
      end,
    );
    expect(findMany.mock.calls[0]?.[0].where.contract).toMatchObject({
      hiddenAt: null,
      legalEntityId: 'company-a',
      ownerUserId: 'user-a',
      branchId: { in: ['branch-a'] },
      createdAt: { gte: start, lt: end },
      status: {
        in: ['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'],
      },
    });
    expect(result.rows).toEqual([
      { country: 'کشور الف', hotel: 'Hotel A', count: 2 },
      { country: 'کشور ب', hotel: 'Hotel B', count: 1 },
    ]);
    expect(result.truncated).toBe(false);
  });
});
