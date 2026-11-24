import 'reflect-metadata';
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
  const controller = new NoraMetricsController(
    { dashboardProjection } as unknown as ReportingService,
    {
      client: { user: { findFirst }, branch: { findMany } },
    } as unknown as DatabaseService,
    { authenticateSessionReferenceV1 } as unknown as IamService,
  );
  return {
    actor,
    controller,
    dashboardProjection,
    authenticateSessionReferenceV1,
    findFirst,
    findMany,
    request: { actor } as unknown as AuthenticatedRequest,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('Nora metric authorization', () => {
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
