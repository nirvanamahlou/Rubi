import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { ReportingRepository } from './reporting.repository';

describe('explicit form save history persistence', () => {
  it('inserts the saved report and SAVE action in one transaction', async () => {
    const savedId = '22222222-2222-4222-8222-222222222222';
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: savedId }]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const database = {
      client: {
        $transaction: vi.fn(
          (work: (client: typeof transaction) => Promise<unknown>) =>
            work(transaction),
        ),
      },
    } as unknown as DatabaseService;
    const repository = new ReportingRepository(database);

    await expect(
      repository.createSaved('11111111-1111-4111-8111-111111111111', {
        reportCode: 'sales_by_service_route',
        name: 'گزارش سفر',
        sharingScope: 'PERSONAL',
        filterState: { currency: 'IRR', filterValues: {} },
        runMetadata: { viewName: 'reporting.travel.facts.v1', viewVersion: 1 },
      }),
    ).resolves.toEqual({ id: savedId });

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    const statement = transaction.$executeRaw.mock.calls[0]?.[0] as {
      strings: readonly string[];
      values: readonly unknown[];
    };
    expect(statement.strings.join('')).toContain(
      'INSERT INTO "reporting_runs"',
    );
    expect(statement.values).toContain(savedId);
    expect(statement.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: 'SAVE', currency: 'IRR' }),
      ]),
    );
  });

  it('persists one successful history row for each newly shared recipient', async () => {
    const transaction = {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const database = {
      client: {
        $transaction: vi.fn(
          (work: (client: typeof transaction) => Promise<unknown>) =>
            work(transaction),
        ),
      },
    } as unknown as DatabaseService;
    const repository = new ReportingRepository(database);

    await repository.replaceSavedReportShares(
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      ['33333333-3333-4333-8333-333333333333'],
      [
        {
          reportCode: 'sales_by_service_route',
          filterSnapshot: {
            actionType: 'SHARE',
            recipientName: 'کاربر مجاز',
          },
          viewName: 'reporting.travel.facts.v1',
          viewVersion: 1,
        },
      ],
    );

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(4);
    const historyStatement = transaction.$executeRaw.mock.calls[3]?.[0] as {
      strings: readonly string[];
      values: readonly unknown[];
    };
    expect(historyStatement.strings.join('')).toContain(
      'INSERT INTO "reporting_runs"',
    );
    expect(historyStatement.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: 'SHARE',
          recipientName: 'کاربر مجاز',
        }),
      ]),
    );
  });

  it('writes a deletion history row only after deleting the owned report', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          reportCode: 'sales_by_service_route',
          name: 'گزارش سفر',
          filterState: { currency: 'IRR' },
        },
      ]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const database = {
      client: {
        $transaction: vi.fn(
          (work: (client: typeof transaction) => Promise<unknown>) =>
            work(transaction),
        ),
      },
    } as unknown as DatabaseService;
    const repository = new ReportingRepository(database);

    await expect(
      repository.deleteSavedWithHistory(
        '22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
        { viewName: 'reporting.travel.facts.v1', viewVersion: 1 },
      ),
    ).resolves.toBe(1);

    const historyStatement = transaction.$executeRaw.mock.calls[0]?.[0] as {
      strings: readonly string[];
      values: readonly unknown[];
    };
    expect(historyStatement.strings.join('')).toContain(
      'INSERT INTO "reporting_runs"',
    );
    expect(historyStatement.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: 'DELETE_SAVED',
          reportName: 'گزارش سفر',
        }),
      ]),
    );
  });
});
