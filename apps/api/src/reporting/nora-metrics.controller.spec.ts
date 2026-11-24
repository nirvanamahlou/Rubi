import 'reflect-metadata';
import type { ModuleRef } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { NoraMetricsController } from './nora-metrics.controller';
import type { ReportingService } from './reporting.service';

const id = '00000000-0000-4000-8000-000000000002';
function setup() {
  const actor = {
    userId: id,
    sessionId: 'test-session',
    permissions: [],
    branchIds: ['branch-a'],
  };
  const dashboardProjection = vi.fn().mockResolvedValue({
    state: 'ready',
    metadata: { reportVersion: 'reporting.dashboard.native.v1' },
    metrics: { collected: { value: '۲۰ IRR · ۳ USD' } },
    visuals: { internal: {} },
  });
  const findFirst = vi.fn().mockResolvedValue({ id });
  const findMany = vi
    .fn()
    .mockResolvedValue([{ id: 'branch-a' }, { id: 'branch-b' }]);
  const authenticateSessionReferenceV1 = vi.fn().mockResolvedValue(actor);
  const get = vi.fn();
  const controller = new NoraMetricsController(
    { dashboardProjection } as unknown as ReportingService,
    {
      client: { user: { findFirst }, branch: { findMany } },
    } as unknown as DatabaseService,
    { authenticateSessionReferenceV1 } as unknown as IamService,
    { get } as unknown as ModuleRef,
  );
  return {
    actor,
    controller,
    dashboardProjection,
    authenticateSessionReferenceV1,
    findFirst,
    findMany,
    get,
    request: { actor } as unknown as AuthenticatedRequest,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('Nora metric authorization', () => {
  it('counts the active native campaigns without exposing names or budget', async () => {
    const h = setup();
    vi.stubEnv('NORA_DEMO_BUSINESS_READ_USER_ID', id);
    const listCampaignPage = vi.fn().mockResolvedValue({
      total: 14,
      data: [{ name: 'private name', budget: 500 }],
    });
    h.get.mockReturnValue({ listCampaignPage });
    await expect(
      h.controller.metric(
        'active-marketing-campaigns',
        'current',
        'false',
        h.request,
      ),
    ).resolves.toEqual({
      version: 1,
      id: 'active-marketing-campaigns',
      range: 'current',
      scope: 'organization',
      value: '۱۴',
    });
    expect(listCampaignPage).toHaveBeenCalledWith(
      { page: 1, pageSize: 1, status: 'ACTIVE' },
      expect.objectContaining({
        permissions: expect.arrayContaining(['marketing.read']),
      }),
    );
    expect(h.actor.permissions).toEqual([]);
  });

  it('uses the selected company and only the total of posted journals from authorized books', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T21:00:01Z'));
    try {
      const h = setup();
      const books = vi.fn().mockResolvedValue({
        isAggregate: false,
        selection: 'company-a',
        books: [{ id: 'book-a' }, { id: 'book-b' }],
      });
      const journals = vi
        .fn()
        .mockResolvedValueOnce({ total: 32 })
        .mockResolvedValueOnce({ total: 11 });
      h.get.mockReturnValue({ books, journals });
      await expect(
        h.controller.metric(
          'posted-accounting-journals',
          'today',
          'false',
          h.request,
        ),
      ).resolves.toMatchObject({ scope: 'selected-company', value: '۴۳' });
      expect(
        journals.mock.calls.map(([book, query, actor]) => ({
          book,
          query,
          actor,
        })),
      ).toEqual(
        ['book-a', 'book-b'].map((book) => ({
          book,
          query: {
            from: '2026-11-24',
            to: '2026-11-24',
            status: 'POSTED',
            page: '1',
          },
          actor: h.actor,
        })),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('discards journal totals if the company changes while reading', async () => {
    const h = setup();
    h.get.mockReturnValue({
      books: vi
        .fn()
        .mockResolvedValueOnce({ selection: 'company-a', books: [{ id: 'a' }] })
        .mockResolvedValueOnce({
          selection: 'company-b',
          books: [{ id: 'b' }],
        }),
      journals: vi.fn().mockResolvedValue({ total: 4 }),
    });
    await expect(
      h.controller.metric(
        'posted-accounting-journals',
        'week',
        'false',
        h.request,
      ),
    ).rejects.toThrow('Forbidden');
  });

  it('reads buy-and-supply request counts from the Procurement report without including other report fields', async () => {
    const h = setup();
    const report = vi.fn().mockResolvedValue({
      counts: [
        { status: 'OPEN', count: 4 },
        { status: 'CLOSED', count: 7 },
      ],
      groups: { items: [{ label: 'private supplier' }] },
    });
    h.get.mockReturnValue({ report });
    await expect(
      h.controller.metric(
        'procurement-request-count',
        'current',
        'true',
        h.request,
      ),
    ).resolves.toMatchObject({ scope: 'authorized', value: '۱۱' });
    expect(report).toHaveBeenCalledWith(
      { dimension: 'currency', page: 1 },
      h.actor,
    );
  });

  it('uses the verified account for organization-wide read scope without returning underlying data', async () => {
    const h = setup();
    vi.stubEnv('NORA_DEMO_BUSINESS_READ_USER_ID', id);
    const result = await h.controller.metric(
      'collected',
      'week',
      'false',
      h.request,
    );
    expect(result).toEqual({
      version: 1,
      id: 'collected',
      range: 'week',
      scope: 'organization',
      value: '۲۰ IRR · ۳ USD',
    });
    expect(h.dashboardProjection).toHaveBeenCalledWith(
      expect.objectContaining({ kpiIds: 'collected', visualIds: '' }),
      expect.objectContaining({
        branchIds: ['branch-a', 'branch-b'],
        permissions: expect.arrayContaining(['sales.payments.read']),
      }),
    );
    expect(h.authenticateSessionReferenceV1).toHaveBeenCalledWith(
      id,
      'test-session',
    );
    expect(h.actor.permissions).toEqual([]);
  });

  it('preserves the ordinary actor and never elevates a user whose current canonical identity does not match', async () => {
    const h = setup();
    vi.stubEnv('NORA_DEMO_BUSINESS_READ_USER_ID', id);
    h.findFirst.mockResolvedValue(null);
    await expect(
      h.controller.metric('collected', 'week', 'false', h.request),
    ).resolves.toMatchObject({
      scope: 'aggregate-required',
      value: null,
    });
    await expect(
      h.controller.metric('collected', 'week', 'true', h.request),
    ).resolves.toMatchObject({
      scope: 'authorized',
    });
    expect(h.dashboardProjection.mock.calls[0]?.[1]).toBe(h.actor);
    expect(h.findMany).not.toHaveBeenCalled();
  });

  it('rejects unsupported sources and revocation before returning data', async () => {
    const h = setup();
    vi.stubEnv('NORA_DEMO_BUSINESS_READ_USER_ID', id);
    await expect(
      h.controller.metric('hidden-raw-data', 'week', 'true', h.request),
    ).rejects.toThrow('NORA_METRIC_UNSUPPORTED');
    expect(h.dashboardProjection).not.toHaveBeenCalled();
    h.findFirst.mockResolvedValueOnce({ id }).mockResolvedValueOnce(null);
    await expect(
      h.controller.metric('collected', 'week', 'true', h.request),
    ).rejects.toThrow();
  });
});
