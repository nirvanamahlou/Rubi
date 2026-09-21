import { describe, expect, it, vi } from 'vitest';

import { ReportingService, type ReportingActor } from './reporting.service';
import type { ReportQueryV1 } from './reporting.contracts';

const actor: ReportingActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  branchIds: [],
  permissions: ['reporting.read', 'reporting.sales.read', 'reporting.export'],
};
const query: ReportQueryV1 = {
  filters: { currencyCode: 'IRR' },
  page: 1,
  pageSize: 25,
  timezone: 'Asia/Tehran',
};

function repository() {
  return {
    facts: vi.fn().mockResolvedValue([]),
    createRun: vi
      .fn()
      .mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' }),
    finishRun: vi.fn().mockResolvedValue(1),
    failRun: vi.fn().mockResolvedValue(1),
    createSaved: vi
      .fn()
      .mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' }),
    listRuns: vi.fn().mockResolvedValue([]),
    createExport: vi
      .fn()
      .mockResolvedValue({ id: '44444444-4444-4444-8444-444444444444' }),
    finishExport: vi.fn().mockResolvedValue(1),
    failExport: vi.fn().mockResolvedValue(1),
  };
}

describe('Reporting form action history', () => {
  it('logs only the explicit result button, not ordinary preview requests', async () => {
    const repo = repository();
    const service = new ReportingService(repo as never);
    await service.preview('sales_by_service_route', query, actor);
    expect(repo.createRun).not.toHaveBeenCalled();

    await service.previewRun('sales_by_service_route', query, actor);
    expect(repo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: actor.userId,
        reportCode: 'sales_by_service_route',
        filterSnapshot: expect.objectContaining({
          actionType: 'PREVIEW',
          filters: query.filters,
        }),
      }),
    );
    expect(repo.finishRun).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      0,
      expect.any(Number),
    );
  });

  it('marks a failed result request as failed in the same run row', async () => {
    const repo = repository();
    repo.facts.mockRejectedValueOnce(new Error('connection lost'));
    const service = new ReportingService(repo as never);
    await expect(
      service.previewRun('sales_by_service_route', query, actor),
    ).rejects.toThrow('connection lost');
    expect(repo.failRun).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'نمایش نتیجه ناموفق بود.',
      expect.any(Number),
    );
  });

  it('marks only an explicit form save, never an incidental favorite save', async () => {
    const repo = repository();
    const service = new ReportingService(repo as never);
    const saved = {
      reportCode: 'sales_by_service_route',
      name: 'گزارش سفر',
      sharingScope: 'PERSONAL',
      isFavorite: false,
      filterState: { currency: 'IRR', filterValues: {} },
    };
    await service.saveReport(saved, actor);
    expect(repo.createSaved.mock.calls[0]?.[1]).not.toHaveProperty(
      'runMetadata',
    );

    await service.saveReport({ ...saved, recordAction: true }, actor);
    expect(repo.createSaved.mock.calls[1]?.[1]).toMatchObject({
      runMetadata: { viewVersion: 1 },
      filterState: saved.filterState,
    });
  });

  it('labels export generation and records its controlled failure', async () => {
    const repo = repository();
    const service = new ReportingService(
      repo as never,
      {
        build: vi.fn(),
        store: vi.fn(),
        read: vi.fn(),
      } as never,
    );
    const result = await service.createExport(
      'sales_by_service_route',
      { format: 'CSV', query, simulateFailure: true },
      actor,
    );
    expect(result.status).toBe('FAILED');
    expect(repo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        filterSnapshot: expect.objectContaining({ actionType: 'EXPORT' }),
      }),
    );
    expect(repo.failRun).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      expect.any(String),
      expect.any(Number),
    );
  });

  it('records an export click even when fetching its data fails', async () => {
    const repo = repository();
    repo.facts.mockRejectedValueOnce(new Error('connection lost'));
    const service = new ReportingService(
      repo as never,
      { build: vi.fn(), store: vi.fn(), read: vi.fn() } as never,
    );
    await expect(
      service.createExport(
        'sales_by_service_route',
        { format: 'CSV', query },
        actor,
      ),
    ).rejects.toThrow('connection lost');
    expect(repo.createRun).toHaveBeenCalledOnce();
    expect(repo.failRun).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'دریافت داده برای خروجی ناموفق بود.',
      expect.any(Number),
    );
  });
});
