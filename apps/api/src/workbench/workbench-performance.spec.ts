import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchPerformanceService } from './workbench-performance.service';

const actor: AuthenticatedActor = {
  userId: 'self',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [],
};
const now = () => new Date(Date.now() - 1000).toISOString();
function fixture() {
  const hr = {
    get: vi.fn().mockResolvedValue({ employee: null }),
    activity: vi.fn().mockResolvedValue([]),
  };
  const sales = {
    list: vi.fn().mockResolvedValue({ data: [] }),
    history: vi.fn().mockResolvedValue({ data: [] }),
  };
  const iam = { listSelfActivity: vi.fn().mockResolvedValue({ data: [] }) };
  const customers = { activity: vi.fn().mockResolvedValue({ data: [] }) };
  return {
    hr,
    sales,
    iam,
    customers,
    service: new WorkbenchPerformanceService(
      hr as never,
      sales as never,
      iam as never,
      customers as never,
    ),
  };
}
function contract(
  id: string,
  amount: string,
  currencyCode = 'IRR',
  status = 'CONFIRMED',
  customerId = 'customer',
) {
  return {
    id,
    ownerUserId: 'self',
    branchId: 'branch',
    status,
    customerId,
    balances: [{ amount, currencyCode }],
  };
}
describe('self performance aggregation', () => {
  it('reads related customer activity only with permission and retains only own in-branch actions', async () => {
    const f = fixture();
    f.sales.list.mockResolvedValue({ data: [contract('one', '1')] });
    f.customers.activity.mockResolvedValue({
      data: [
        {
          id: 'mine',
          type: 'created',
          actor: { userId: 'self' },
          actorBranchId: 'branch',
          occurredAt: now(),
        },
        {
          id: 'colleague',
          type: 'created',
          actor: { userId: 'other' },
          actorBranchId: 'branch',
          occurredAt: now(),
        },
        {
          id: 'outside',
          type: 'created',
          actor: { userId: 'self' },
          actorBranchId: 'outside',
          occurredAt: now(),
        },
      ],
    });
    await f.service.get({
      ...actor,
      permissions: ['sales.contracts.read.own'],
    });
    expect(f.customers.activity).not.toHaveBeenCalled();
    const result = await f.service.get({
      ...actor,
      permissions: ['sales.contracts.read.own', 'customers.read'],
    });
    expect(result.activity).toMatchObject({
      status: 'ready',
      data: { recent: [{ id: 'mine', moduleLabel: 'مشتریان' }] },
    });
  });
  it('does not read Sales without its read permission, and isolates HR errors', async () => {
    const f = fixture();
    f.hr.get.mockRejectedValue(new Error('private database details'));
    const result = await f.service.get(actor);
    expect(result.sales.status).toBe('forbidden');
    expect(f.sales.list).not.toHaveBeenCalled();
    expect(result.hr.status).toBe('error');
    expect(JSON.stringify(result)).not.toContain('private database');
    expect(result.activity.status).toBe('ready');
  });
  it('keeps admin metrics self/branch scoped, exact per currency and excludes draft/cancelled sales', async () => {
    const f = fixture();
    f.sales.list.mockResolvedValue({
      data: [
        contract('1', '9007199254740993.10'),
        contract('2', '0.20'),
        contract('3', '2.50', 'USD', 'COMPLETED', 'second'),
        contract('4', '900', 'IRR', 'DRAFT'),
        contract('5', '900', 'IRR', 'CANCELLED'),
        { ...contract('6', '900'), ownerUserId: 'other' },
        { ...contract('7', '900'), branchId: 'outside' },
      ],
    });
    const result = await f.service.get({
      ...actor,
      permissions: ['sales.contracts.read.all'],
    });
    expect(result.sales).toEqual({
      status: 'ready',
      data: {
        contracts: 5,
        confirmedContracts: 3,
        customers: 2,
        amounts: [
          { currencyCode: 'IRR', amount: '9007199254740993.3' },
          { currencyCode: 'USD', amount: '2.5' },
        ],
        partial: false,
      },
    });
    expect(f.sales.list).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: 'self',
        branchId: 'branch',
        createdFrom: expect.any(String),
      }),
      expect.objectContaining({ userId: 'self' }),
      1000,
    );
  });
  it('marks capped figures partial instead of presenting them as full totals', async () => {
    const f = fixture();
    f.sales.list.mockResolvedValue({
      data: Array.from({ length: 1001 }, (_, i) => contract(String(i), '1')),
    });
    const result = await f.service.get({
      ...actor,
      permissions: ['sales.contracts.read.own'],
    });
    expect(result.sales).toMatchObject({
      status: 'ready',
      data: { partial: true, contracts: 1000 },
    });
  });
  it('uses actual own contract history and excludes colleague changes', async () => {
    const f = fixture();
    f.sales.list.mockResolvedValue({ data: [contract('one', '1')] });
    f.sales.history.mockResolvedValue({
      data: [
        {
          id: 'mine',
          changedByUserId: 'self',
          toStatus: 'CONFIRMED',
          changedAt: new Date(now()),
        },
        {
          id: 'theirs',
          changedByUserId: 'other',
          toStatus: 'COMPLETED',
          changedAt: new Date(now()),
        },
      ],
    });
    const result = await f.service.get({
      ...actor,
      permissions: ['sales.contracts.read.own'],
    });
    expect(result.activity).toMatchObject({
      status: 'ready',
      data: { recent: [{ id: 'mine', entityId: null, moduleLabel: 'فروش' }] },
    });
    expect(JSON.stringify(result)).not.toContain('theirs');
  });
  it('filters activity by current module permission and time, without record IDs', async () => {
    const f = fixture();
    f.iam.listSelfActivity.mockResolvedValue({
      data: [
        {
          id: 'a',
          action: 'finance.update',
          occurredAt: now(),
          entityId: 'secret',
        },
        {
          id: 'b',
          action: 'workbench.note.create',
          occurredAt: now(),
          entityId: 'note',
        },
        {
          id: 'c',
          action: 'workbench.note.create',
          occurredAt: '2000-01-01T00:00:00.000Z',
        },
      ],
    });
    const result = await f.service.get(actor);
    expect(result.activity).toMatchObject({
      status: 'ready',
      data: {
        modules: [{ key: 'workbench', count: 1 }],
        recent: [{ id: 'b', entityId: null }],
      },
    });
  });
  it('rejects invalid ranges before any producer call', async () => {
    const f = fixture();
    await expect(f.service.get(actor, '999')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(f.hr.get).not.toHaveBeenCalled();
  });
  it('preserves permission failures as forbidden', async () => {
    const f = fixture();
    f.hr.get.mockRejectedValue(new ForbiddenException('مجاز نیست'));
    expect((await f.service.get(actor)).hr.status).toBe('forbidden');
  });
});
