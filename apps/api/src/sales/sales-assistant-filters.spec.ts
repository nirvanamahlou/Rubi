import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { parseAssistantReportFilters } from './sales-assistant-filters';
import { SalesAssistantController } from './sales-assistant.controller';

const branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const origin = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = new Date('2026-10-13T08:00:00Z');
const actor = {
  userId: 'a',
  sessionId: 's',
  permissions: ['sales.contracts.read.all', 'sales.payments.read'],
  branchIds: [branch],
} as AuthenticatedActor;

describe('assistant versioned filters', () => {
  it('retains weekly defaults and computes inclusive civil dates with an equal preceding period', () => {
    const daily = parseAssistantReportFilters(
      { startDate: '2026-10-12', endDate: '2026-10-12' },
      actor,
      now,
    );
    expect(daily.windows).toEqual({
      current: {
        startUtc: '2026-10-11T20:30:00.000Z',
        endUtc: '2026-10-12T20:30:00.000Z',
      },
      previous: {
        startUtc: '2026-10-10T20:30:00.000Z',
        endUtc: '2026-10-11T20:30:00.000Z',
      },
    });
    expect(parseAssistantReportFilters({}, actor, now).filters).toMatchObject({
      startDate: '2026-10-06',
      endDate: '2026-10-12',
      branchId: null,
    });
    expect(
      parseAssistantReportFilters(
        { startDate: '2026-07-15', endDate: '2026-10-12' },
        actor,
        now,
      ).windows.previous.endUtc,
    ).toBe('2026-07-14T20:30:00.000Z');
  });
  it('rejects invalid dates, oversized windows, scope escalation and extra selectors', () => {
    for (const query of [
      { startDate: '2026-02-30', endDate: '2026-03-01' },
      { startDate: '2026-10-12' },
      { startDate: '2026-07-14', endDate: '2026-10-12' },
      { startDate: '2026-10-13', endDate: '2026-10-13' },
      { companyId: branch },
      { userId: branch },
      { branchId: [branch] },
      { originId: 'SQL' },
    ])
      expect(() => parseAssistantReportFilters(query, actor, now)).toThrow();
    expect(() =>
      parseAssistantReportFilters({ branchId: origin }, actor, now),
    ).toThrow('ASSISTANT_BRANCH_FORBIDDEN');
  });
  it('applies source-owner query scope, preserves v1 and never dates current balances', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const findMany = vi.fn().mockResolvedValue([]);
      const controller = new SalesAssistantController({
        client: { salesContract: { findMany } },
      } as unknown as DatabaseService);
      const request = { actor } as AuthenticatedRequest;
      const filters = {
        startDate: '2026-10-01',
        endDate: '2026-10-12',
        branchId: branch,
        originId: origin,
      };
      const report = await controller.filtered(request, filters);
      expect(report).toMatchObject({
        version: 2,
        source: 'sales.assistant.report.v2',
        filters,
      });
      expect(findMany.mock.calls[0]?.[0]).toMatchObject({
        where: {
          branchId: branch,
          originId: origin,
          createdAt: {
            gte: new Date('2026-09-18T20:30:00Z'),
            lt: new Date('2026-10-12T20:30:00Z'),
          },
        },
        take: 5001,
      });
      const balances = await controller.filteredBalances(request, filters);
      expect(balances.dateBasis).toBe('CURRENT_AS_OF_REQUEST');
      expect(findMany.mock.calls[1]?.[0].where).not.toHaveProperty('createdAt');
      await expect(controller.weekly(request, filters)).rejects.toThrow(
        'ASSISTANT_FIXED_SCOPE',
      );
      findMany.mockClear();
      await expect(
        controller.filtered(request, { branchId: origin }),
      ).rejects.toThrow('ASSISTANT_BRANCH_FORBIDDEN');
      expect(findMany).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

it('uses the first real instant on historical Tehran DST days', () => {
  const result = parseAssistantReportFilters(
    { startDate: '2021-03-22', endDate: '2021-03-22' },
    actor,
    now,
  );
  expect(result.windows.current).toEqual({
    startUtc: '2021-03-21T20:30:00.000Z',
    endUtc: '2021-03-22T19:30:00.000Z',
  });
});
